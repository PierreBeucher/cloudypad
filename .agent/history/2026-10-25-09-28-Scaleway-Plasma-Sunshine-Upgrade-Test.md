# Scaleway Plasma/Sunshine upgrade test — branch validation + instance upgrade

Deploy and validate the `dockerfile-update-plasma-desktop` branch (Sunshine 2026 + Plasma 6) on real Scaleway L4 instances, then prove an in-place upgrade from latest release keeps user data (pairing, Steam, games) intact.

## Initial iteration

> Thisbranchc contains changes for an upgrade of Sunshine along with a new desktop for our Sunshine container. Wa are now testing it on actual instances on Scaleway. You'll use the CLI locally to deploy a Scaleway instance with our development environment:
> - Use CLI locally to deploy, adapting the Sunshine image to use our latest image
> - Build and push local image using branch name as needed
> - For debugging and fast feedback loop, make sure to use appropriate shortcuts when doing updates
>
> Now plan:
> - How you'll deploy initial test instance
> - How you'll test
> - How you can debug a quick NVIDIA driver update
> - How you can debug a quick container rebuild
>
> Consider session summaries in tmp/2026-10-24-before-summary/ to have aan understanding of previous session runs.
>
> Our goal:
> - Have a working Scaleway instance with properly starting services
> - Being able to run Clair Obscur E33 - with default config, then with framegen and DLSS enabled
>
> Plan now

### Code changes

None (planning). Session summaries in `tmp/2026-10-24-before-summary/` reviewed first (NVIDIA NVENC session, labwc Dockerfile sessions) — they carried the known traps: driver 615 breaks NVENC (pinned 590.48.01), container userspace must match host and needs `--force-recreate`, Sunshine 2026 CSRF origins, stale pairing state.

### Issues encountered

- Pre-read context is gold: the NVENC session summary alone saved hours (encoder-probe log signature `Found H.264 encoder: h264_nvenc` vs `libx264 [software]`, driver pin root-cause, force-recreate vs restart).
- Deployed `test-instance-scw-plasma`: L4-1-24G, fr-par-2, 120G data disk (user bumped from 80), personal SSH key via `--ssh-private-key ~/.ssh/id_ed25519`, image tag = branch name. Full deploy ≈ 12 min. Autostop (300s) stopped the instance before first SSH check — expected behavior, not a bug: autostop only counts Moonlight/stream activity.

## Iteration 2 — first instance validation, Steam setup

> I'm now logged-in to Steam. Check, without actually downloading it: can you download Expedition 33? [...] let's install it

### Code changes

None — CLI/deploy operations only.

### Issues encountered

- **Ownership check headless**: public Steam profile was private, steamcmd requires the account password (aborted — never ask for passwords). Found proof in `/cloudy/data/Steam/logs/steamui_librarycache.txt`: the library asset sync only processes owned apps — "Completed asset downloads for app 1903340" = owned.
- **Install**: `steam://install/1903340` via `steam-start.sh` wrapper opens a GUI dialog (one user click); download itself monitored via `appmanifest_1903340.acf` + `du` on staging dir (~620 Mbps, 46 GB in ~8 min).
- **autostop would kill a download**: autostop watches Moonlight UDP 47999 + network download > 10 Mbps + ansible processes. Downloads ARE detected by the network checker — I had wrongly claimed only Moonlight counted. User challenged; I read the full `autostop.py` and corrected myself. Service can be stopped at runtime (`sudo systemctl stop cloudypad-autostop`) and comes back on next start.

## Iteration 3 — display-quality archaeology and instance improvements

> let's do a bit of archeology: I remember enabling some time ago an NVIDIA driver flag [...] It wasn't on our current branch from master [...] Find this flag or option for me

Then: "good. For AV1 I am to do anything apart Moonlight config?", "Any way to prefer AV1 on Sunshine side?", "remind me [of recommendations]", "let's do 1, 4 and 5. Code as needed, and update instance appropriately so it persists"

### Code changes

Commit `92fe50e` — NvFBC capture on datacenter GPUs (templated `CLOUDYPAD_SUNSHINE_CAPTURE` compose env: nvfbc on Tesla, x11 elsewhere, safe fallback in `start-sunshine.sh`), Baloo indexer disabled via seeded `baloofilerc`, supervisord control socket restored (`[unix_http_server]` + `[supervisorctl]` + `[rpcinterface:supervisor]`, dropped in the Plasma rework). Instance state: `maxBitrateKbps: 80000`.

### Issues encountered

- The remembered flag: **`ForceFullCompositionPipeline`** (commit 89ec773, Aug 2025, in master, present on branch) — applied per Sunshine session via `nvidia-settings --assign CurrentMetaMode=...`. Verified live: `nvidia-settings` IS shipped by the Tesla datacenter `.run` (my concern it might not be was unfounded), meta mode shows `ForceFullCompositionPipeline=On`. BUT it only fixes *scanout* tearing — Sunshine's x11 capture reads the framebuffer directly, so capture-side tearing persists with KWin fullscreen unredirect. Root fix = NvFBC.
- **Bitrate**: `max_bitrate = 0` means *no server cap* — the effective bitrate was Moonlight's client setting (~15 Mbps observed in logs). Setting 80000 is a ceiling, client slider must rise too.
- **AV1**: nothing needed server-side — Sunshine advertises per encoder capability (`av1_mode = 0`), client picks codec. L4 (Ada) NVENC does H.264/HEVC/AV1, all three probed working.
- **Targeted ansible `-t sunshine-docker` fails on missing nvidia facts** (`sunshine_nvidia_driver_version`, `nvidia_required_driver_type`, `nvidia_gpu_model`, `nvidia_pci_bus_id` — normally set by the sunshine role's nvidia.yml tasks). Robust shortcut: `-t sunshine-docker,nvidia`. Passing facts via `--ansible-args-override -e` breaks for values containing spaces (node `spawnSync` with `shell:true` wraps the command in single quotes; embedded quotes terminate it early — `nvidia_gpu_model='NVIDIA L4'` arrived as `NVIDIA`).
- **`--ansible-args-override` + supervisord**: this branch had no `[unix_http_server]` socket so `supervisorctl` was unusable; verified services via `pgrep` until the socket was restored.
- NvFBC validated live on the instance by editing the conf template in-container, `pkill sunshine` (supervisord auto-restarts), checking `Screencasting with NvFBC`, then reverting.
- Persistence through stop/start verified explicitly: state is source of truth, start quick-config (`-t ratelimit,data-disk,sunshine`) re-renders compose, `pull: always` refreshes the image tag, baloofilerc lives on the data-disk-mounted `~/.config`.

## Iteration 4 — upgrade compatibility analysis

> our changes are supposedly compatible between instances. First chance: between this current branch and latest release, are there any breaking change on our branch that may cause issue if we upgrade to new instance? [...] what is Sunshine recommended / official upgrade path then? [...] there's no "upgrade guide" or upgrade docs? What does the doc or release note say about this breaking change? Does Sunshine auto detect old state?

### Code changes

None — read-only analysis (git archaeology v0.45.2 vs branch, Sunshine release notes, `nvhttp.cpp` diff).

### Issues encountered

- Breaking changes on branch: desktop Xfce→Plasma (user desktop prefs lost — old ones were ephemeral anyway), display-driver pin 595.58.03→595.99.02 (GeForce only; datacenter unchanged 590.48.01). State schemas unchanged.
- **Sunshine pairing state is NOT a breaking change** (I initially claimed it was, user pushed back): `nvhttp.cpp` load() is identical between 2025.924 and 2026.914 — auto-imports the legacy pre-2025.118 `devices` format, reads `named_devices` natively, 2026 only adds an `enabled` flag defaulting true. Earlier re-pair incidents were likely the duplicate-client-certs bug (fixed upstream in v2026.1018 "replace duplicate client certificates" — our image pins v2026.914 which predates it).
- Sunshine has no upgrade guide; migration notes live in GitHub release notes ("⚠️ Breaking changes and migration notes"). Relevant 2026 items: libvirtualhid (gamepad identity may change), input key rename, package renames. Nothing about state files.
- Latest release (v0.45.2) is **currently broken on fresh Scaleway GPU images**: its `nvidia-container-toolkit=1.19.0-1` pin is refused by apt as a downgrade (image drift — preinstalled toolkit is newer). Branch already pins 1.20.1-1. Patched the master worktree locally to create the baseline.

## Iteration 5 — baseline creation chaos (biggest lesson of the session)

> Let's create our older-master instance and upgrade it then. Plan it first [...] Path A for now. Go

### Code changes

None in repo (worktree-local patch for the toolkit pin; worktree removed afterwards).

### Issues encountered

The baseline must be created from **master code**, so I set up a git worktree (`.worktrees/master-upgrade` per skill, `pnpm install` fast thanks to the store). Then a cascade of self-inflicted process failures:

1. **Four times** I launched the create `nohup ... &` **without the `workdir` parameter** — it ran from the main repo (branch code) instead of the worktree. Each wrong-cwd create had to be killed.
2. **pgrep/pkill self-matching**: `pgrep -f "pattern"` matches my own command line (the pattern string is in my bash -c). Reported "RUNNING" for finished processes repeatedly. Worse: `pkill -9 -f "tsx src/cli/main.ts create"` matched (a) my own bash wrapper and (b) **pkill itself** — it killed my wrapper, then itself, **before signaling the target**. The create process survived and ran to completion in the background for over an hour, creating a duplicate server and holding the pulumi stack lock.
3. **Pulumi stale locks** from killed processes → `pulumi cancel -y -s organization/CloudyPad-Scaleway/<stack>`.
4. **Two state backends** (the thing that took longest to untangle): `flake.nix` devshell sets `CLOUDYPAD_HOME="$PWD/test/integ/.data-root-dir"` — **$PWD-relative**, so the worktree CLI used `.worktrees/master-upgrade/test/integ/.data-root-dir` (its own state + pulumi file backend) while the main repo CLI used `core/test/integ/.data-root-dir`. Each create wrote its own state and created its own server. No shared lock, no shared state — "two instances named plasma-upgrade-test on Scaleway" was the symptom.
5. Cleanup: scaleway inventory via `scw` (server/volume/snapshot/image/security-group, block volumes under `scw block volume list` — instance volumes list misses SBS), manual deletions for orphans, `pulumi stack rm -y --force` for stale stacks.

**Rules learned**: always set `workdir` in the same tool call as the nohup launch (verify with `readlink /proc/<pid>/cwd` immediately); never pkill with a pattern contained in your own command line (bracket trick `[t]sx` only fixes pgrep display, pkill still self-matches — enumerate PIDs from a bracketed pgrep instead, or check ps first); after any kill, verify by *resource inventory* (scw list), not process lists.

## Iteration 6 — upgrade mechanics + Path A execution

> on upgrade, we'll create a new base image disk and will just replace the existing base image with our new one, then reboot instance as usual - data disk remain untouyched. Right? [...] let's go with upgrade. Clean up the master-branch worktree before to avoid side effect.

### Code changes

None committed. State updated via a small TS script (`tmp/upgrade-state.ts`): `imageTag: dockerfile-update-plasma-desktop`, `maxBitrateKbps: 80000`.

### Issues encountered

- Upgrade mechanics confirmed in code: deploy = provision same server (running) → configure (new image pulled+recreated, new ansible) → stop-in-place → base image snapshot (`replaceOnChanges: [volumeId]` + `deleteBeforeReplace` → old image replaced) → same server started. **Data disk untouched the entire deploy** (data disk snapshot only updates on `stop`). Nuance: server is NOT rebuilt from the new base image during upgrade — that happens at the *next* stop/start.
- **`update` command bug discovered**: `update scaleway` offers `--sunshine-image-tag`/`--sunshine-max-bitrate-kbps` but the prompter drops the whole sunshine block unless `--streaming-server sunshine` is set — **a flag the update command doesn't even register** (it errors as unknown option). Update's sunshine flags are silently ignored. Standard version-based upgrades are unaffected (unset tag → falls back to current `CLOUDYPAD_VERSION`), but explicit pins need the state-script workaround (`getInstanceUpdater().updateStateOnly()`) then `cloudypad deploy`. Flagged for a proper fix on the branch.
- User's instance had been properly stopped meanwhile (server+disk deleted, data in `plasma-upgrade-test-data-volume-snapshot` 120GB) and the user destroyed the stale worktree instance themselves. Worktree removed (`git worktree remove --force` — dirty with the local toolkit patch, explicitly approved).
- Deploy on the stopped instance re-provisioned from old base image + snapshot restore, configured with branch stack, replaced the base image. Verified: image tag = branch, Sunshine 2026.914, `capture = nvfbc`, `max_bitrate = 80000`, NVENC, Plasma up, Steam manifests + `sunshine_state.json` restored on data disk.
- **Result — the whole point**: user reconnected with Moonlight, **no PIN asked, pairing survived the Sunshine major upgrade**; game launched and works. Path A validated end-to-end.

## State at end of session

- `test-instance-scw-plasma` — stopped, holds the branch image validation work (commit 92fe50e)
- `plasma-upgrade-test` — upgraded and validated (user was testing the game); needs stop/destroy decision
- Open follow-ups: (1) fix `update` sunshine-args silently dropped, (2) master's `nvidia-container-toolkit` pin broken on fresh Scaleway GPU images, (3) upstream duplicate-client-certs pairing fix lands in v2026.1018+ (image pins v2026.914 — consider bumping Sunshine pin before release)
