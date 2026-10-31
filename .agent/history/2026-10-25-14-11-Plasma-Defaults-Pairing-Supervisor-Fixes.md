# Plasma defaults, non-interactive pairing and supervisor orphan fix

Branch cleanup (overkill review), Plasma look & feel defaults for new instances, fully non-interactive Moonlight pairing (`task dev:pair`), and the supervisord orphan bug that broke pairing — all validated on real Scaleway L4 instances.

## Initial iteration

> We made quite a few change on our current branch from master. I suspect some of it is overkill since we made quite a few iterations, and maybe do not respect our architecture. Take a look at Git history, AI history in .agent/history/2026-10-25-09-28-Scaleway-Plasma-Sunshine-Upgrade-Test.md, .agent/history/2026-10-25-09-49-plasma-desktop-sunshine-upgrade.md, .agent/history/2026-10-25-09-53-Plasma-Launchers-Dev-Feedback-Loops.md, .agent/history/2026-10-25-09-54-Sunshine-Container-Desktop-Experiments-Fluent-Plasma.md, and review changes. Analysis only. What may be overkill and may not be needed?

### Code changes

None (analysis only).

### Issues encountered

None — produced the overkill review: (1) `hack/dev-sunshine-pin.sh` duplicated the CLI pairer with hardcoded creds, existed only because the `update` command drops sunshine flags; (2) `nvidia-drm-hold` service carried stale labwc/Wayland rationale on an X11 branch; (3) duplicated CSRF block in dev-vagrant.yml, Wayland-justified tmpfs, xfce leftovers (dbus filename, docs); (4) hand-edited generated Paperspace code; (5) appletsrc shipped useless systemtray applets; (6) prompter.ts autostop fix had *removed* the default instead of typing it; (7) pairer changes had no unit tests.

## Iteration 2 — cleanup fixes + fresh instance validation

> 1. cleanup pair script, keep reset state script / 2. Remove this [nvidia-drm-hold] / 3. Fix the duplicate, remove things used by Wayland, cleanup contrib and xfce thing you mentionned. For XDG give more details to take decision. / 4. Ignore. Paperspace will be removed as provider. / 5. Update to OpenCode, global upgrade and our changes are voluntarily on a single branch; no action needed here. - CLOUDYPAD_PLASMA_DEFAULT_FORCE - explain this. - Remove unnecessary things in our environment - fix again the prompter.ts then - Fix pairer unit test. Do the code for now, then deploy me a fresh Scaleway instance to test it.

### Code changes

Deleted pin script + task; fixed reset script refs; removed nvidia-drm-hold entirely (tasks/main.yml back to master); deduped CSRF; removed Wayland tmpfs; renamed `xfce4-dbus-session-bus-address` → `dbus-session-bus-address`; cleaned contribution guide; trimmed battery/vault/devicenotifier/bluetooth/networkmanagement/kupapplet from appletsrc; restored `default: '900'` in prompter; 7 Sunshine pairer unit tests. Built+pushed image, deployed `test-instance-scw-plasma-cleanup`, verified live.

### Issues encountered

- Twice I passed `filePath` text *inside* an edit's `newString`, corrupting files (tasks/main.yml, compose template) — caught by re-reading; restored tasks/main.yml via `git checkout master --`. Lesson: always re-read after multi-block edits.
- `create scaleway --name test-instance-scw-plasma2` prompted "must be kebab case" (trailing digit) and died without TTY under nohup — name must be kebab-safe.
- The autostop nvidia error in deploy logs (`/sys/module/nvidia/version` not found) is expected on fresh servers (fail-then-install task), not a bug.
- First `supervisorctl status` after container start failed with "no such file" — checked 5s after the post-snapshot reboot; socket appears a few seconds in.

## Iteration 3 — commit cleanup

> works nicely. commit our changes.

### Code changes

Commit `0b79238` (cleanup + pairer tests). Excluded unrelated `annonce.md`.

### Issues encountered

None.

## Iteration 4 — Plasma defaults analysis

> Now I changed Plasma config: I used dark theme and increase icon size to 60 on toolbar menu. I want this to become the default... Look at my machine to see how config was persisted, then plan me a way... Analysis and give me a plan, no code yet.

### Code changes

None (analysis only).

### Issues encountered

- Dark theme lives in `~/.config/kdedefaults/{kdeglobals,package,ksplashrc}` (user-chosen defaults layer, cascade over system defaults); NOT in the main kdeglobals palette.
- "Icon size 60 on toolbar menu" is actually **panel thickness**: `~/.config/plasmashellrc → [PlasmaViews][Panel 2][Defaults] thickness=60`. Key insight: "Panel N" N = panel containment id (2 in our seeded appletsrc), so it is deterministic for our layout.
- plasmashell rewrites appletsrc at runtime (nested systemtray, renumbered applets) — seed is read once, then Plasma owns the file; expected.

## Iteration 5 — implement Plasma defaults + full stop/start

> good. Do this, and also do a full stop and start to check it works / only for new instances, older ones I'll keep whatever they have

### Code changes

Shipped defaults in `conf/plasma-default/` (kdedefaults/*, plasmashellrc thickness=60); moved kscreenlockerrc/baloofilerc under plasma-default/; rewrote `setup-plasma-default-desktop.sh` with a freshness gate (session-written files ⇒ existing instance ⇒ skip look & feel seeds; protective seeds still apply when missing); extended `CLOUDYPAD_PLASMA_DEFAULT_FORCE` to all defaults. Deployed, full stop/start validated, wipe+restart validated the fresh path.

### Issues encountered

- **Plasma overwrites pre-seeded theme files at first session start** (applies stock light look-and-feel; confirmed via file mtimes: kdedefaults rewritten at session start while appletsrc/plasmashellrc seeds survive). Pre-session seeding cannot win the theme. Fix: post-session applier `apply-plasma-default-lookandfeel.sh` — waits for plasmashell, runs `plasma-apply-lookandfeel --apply org.kde.breezedark.desktop` (Plasma 6 needs `--apply`, plain arg prints usage), gated by an ephemeral flag in XDG_RUNTIME_DIR (wiped on container restart, so never re-runs).
- `plasma-apply-lookandfeel` works headless in the container with the dbus session address sourced from `export-dbus-address.sh`.
- Simulation harness in tmp/ tested 4 seed paths (fresh / existing / force / fresh-with-custom-file) before deploying.
- User decision recorded: existing instances keep whatever they have → no section-merge for plasmashellrc, pure file-level gating.

## Iteration 6-7 — which instance to test / destroy + recreate

> good. Which instance can I test with? / good. Destroy our cleanup instance and create it again

### Code changes

None to repo (instance lifecycle only).

### Issues encountered

- Destroy verified via `scw` inventory: no server/image/snapshot leftovers.
- Recreated instance's first boot came up with defaults, but the desktop log exposed a **freshness-gate bug**: `plasmashellrc` was in the "existing session" marker list AND is a file we seed ourselves — a fresh instance interrupted before its first session (crash, host reboot) would be misdetected as existing and never get the dark theme. Fixed: marker list is session-written files only (`kactivitymanagerdrc`, `kconf_updaterc`, `plasma-localerc`); validated with a 3-boot simulation (fresh → interrupted → session-ran). Image rebuilt+pushed; did NOT redeploy the running instance (user was testing).

## Iteration 8 — pairing plan (analysis only)

> Actually to pair we use this command, with an "auto" flag, and then in another shell we just have to run moonlight pair command. However on my machine moonlight is aliased to flatpak run com.moonlight_stream.Moonlight. I think you can run the core pair command in the background, non interactive with auto mode, and then run pair command yourself - we could even wrap this as a hack/dev-pair.sh around a task task dev:pair -- instance-name. Confirm this possibility - as needed we can even update the pair command to support non-interactive. Analysis for now, just make a plan

### Code changes

None (analysis only).

### Issues encountered

- `cloudypad pair` had NO flags — always `pairInteractive()` → inquirer select → ExitPromptError without TTY. But `InstanceManager.pairSendPin(pin)` already existed prompt-free; only the mode-select was interactive. Plan: `--pin` (wrapper generates PIN, no output parsing) and `--auto` (non-interactive auto branch); `cloudypad get <name>` gives host JSON.

## Iteration 9 — implement pairing

> go

### Code changes

`pair --pin/--auto` CLI options; `pairAuto()` on MoonlightPairer interface + abstract + manager + runner (InstanceRunner also needed it — provider runners implement the interface); `hack/dev-pair.sh` + `task dev:pair`; pairAuto unit test. Compile + 163 tests green.

### Issues encountered

- Adding `pairAuto` to the manager interface wasn't enough: `buildRunner()` returns `InstanceRunner`, which declares pair methods itself — had to add `pairAuto` there too (4 provider factories' runners all inherit from `AbstractInstanceRunner`, one implementation covers all).
- First live `dev:pair` run failed after ~6s: the CLI `--pin` path used the class default of **3 retries**, giving up before Moonlight's ~6s handshake. (See pairing saga below — this was only layer 1.)

## Iteration 10-13 — the Moonlight pairing saga

> stop. The initial attempt DID work [on instance recreate]... / Is the instance actually running? Check this first. And for our dev pin timeout after 10s - if not done after 10s, something wrong / continue. Last one worked actually / stop. Explain what you're doing now that pairing works / continue then. Our focus is on our dev-pair, make sure this is finished - and finish this alternative fix - but do not do unrelated tasks before asking for confirmation

### Code changes

Sunshine pairer: default retries 3→60→(120×1s), persistent SSH connection across polls (was: reconnect per attempt); freshness bar + stale-entry removal + `moonlight list` verification in dev-pair.sh; later supervisord fix (iteration 14).

### Issues encountered

Pairing failed through FOUR stacked causes, each masking the next — had to peel in order:

1. **Our pairer gave up too early** (3 retries ≈ 6-10s < Moonlight's ~6s handshake). Moonlight then retried its request every ~5s — the "Found unexpected PC ... looking for ..." spam.
2. **Stale Moonlight host entry** (biggest sink): the user had paired instance v1; we destroyed+recreated with the SAME name → Moonlight matches saved hosts by *hostname*, found entry with old cert/uuid → treated the new server as impostor, looped without ever submitting the PIN → Sunshine `/api/pin` stayed `{"pairings":[]}`. Decisive clue: "Found unexpected PC 'X' looking for 'X'" (same name!). Fix: remove same-hostname entries from `~/.var/app/com.moonlight_stream.Moonlight/config/Moonlight Game Streaming Project/Moonlight.conf` (QSettings INI: `[hosts]` section, `N\hostname=...` keys + `size=N`). First removal script blindly rewrote both `size=` keys in the file (clobbered `[gcmapping] size=0` → 1) — the final script is section-aware.
3. **Orphaned Sunshine processes**: supervisord tracked the `start-sunshine.sh` shell, not Sunshine (no exec); on restart only the shell got signaled → Sunshine survived holding 47984/48010 while the new process logged `Fatal: Couldn't bind RTSP server to port [48010], Address already in use` and only served the web UI. Diagnosed via `pgrep -a sunshine` (two PIDs) + supervisord PID mismatch (tracked 482708 vs real 482736) + `ss -tlnp` showing which PID held which port. Workaround `pkill -9 sunshine` (autorestart respawns clean); structural fix in iteration 14.
4. **Confirmation race**: after submitting the PIN Moonlight only waits a couple of seconds observing `PairStatus=1`; our per-attempt SSH reconnect (~2-4s/cycle) confirmed too late (~8-9s) → Moonlight exited non-zero although the pairing was confirmed server-side. Fix: persistent SSH connection + 1s polls in `pairSendPin` (connect() is idempotent via `doConnect`'s `isConnected()` check; on error rebuild the client). dev-pair.sh treats the pairer as authoritative (Moonlight's exit code is unreliable in BOTH directions) and verifies end-to-end via `moonlight list $HOST | grep Desktop`.

Useful diagnostics along the way: direct `curl https://host:47984/pairingrequest?uniqueid=...` with a throwaway client cert returned a proper 401 XML (endpoint alive → not a network/firewall issue); HTTP 47989 serverinfo always worked; `grep -ai pair /cloudy/log/sunshine.log` empty while pairing failed → problem was before Sunshine's pairing state machine. Attempting verbose Sunshine logging via `sed` on the rendered config failed silently: `start-sunshine.sh` re-renders it from the template at every (re)start.

Also: user required a **10s health bar** — "if not done after 10s, something wrong". Implemented as pairer-confirmation deadline in dev-pair.sh (kill + fail-fast with diagnostics), Moonlight gets a grace window (its post-submit polling isn't a health signal), `DEV_PAIR_TIMEOUT_SECS` overridable.

## Iteration 14 — supervisor orphan fix

> stop. Explain what you're doing now that pairing works / continue then... finish this alternative fix - but do not do unrelated tasks before asking for confirmation

### Code changes

`start-sunshine.sh`: `exec sunshine` (supervised process IS Sunshine); `supervisord.conf`: `stopasgroup=true`/`killasgroup=true` on all long-running programs (+ explanatory comment). Image rebuilt (`6985ce36`), deployed, base image replaced.

### Issues encountered

- Verified on instance: supervisord now tracks the real Sunshine PID (157 = pgrep output); after `supervisorctl restart sunshine` exactly one process, all 4 ports bound, pairing unaffected (`moonlight list` still lists Desktop/Steam — server identity lives on the data disk).
- Stopped to explain before deploying since it would kill the user's active Moonlight session (user then approved).

## Iteration 15-18 — commits + pairing post-mortem

> stop our test instance / good. Now commit changes related to plasma changes only. / then explain: what was wrong with Moonlight pairing that took so long? / good. Now commit our pair command updates / finally the supervisor fix

### Code changes

Commits: `4a1e54c` (Plasma defaults only — 10 files), `ca245c1` (pair command updates — 8 files), `a9feb7d` (supervisor orphan fix — 2 files). Stopped instance on request.

### Issues encountered

- Commit splitting required diff inspection: `dev-vagrant.yml` diff was plasma-comment only (in), `Taskfile.yml` diff was the dev:pair task (out of the plasma commit).

## Iteration 19-20 — fresh instance pair check + my reasoning error

> create a fresh scaleway instance and pair it. Just to check it works / stop. The initial attempt DID work. Why do you think it failed?

### Code changes

None (validation only). New instance `test-instance-scw-pair-check` created and paired successfully.

### Issues encountered

- **Misread a tool-kill as a pairing failure**: combined `sleep 90; task dev:pair` exceeded the shell tool's 2-min timeout → tool sent SIGTERM → log showed `task: Failed to run task "dev:pair": exit status 143`. I concluded failure and re-ran. Wrong on both counts: (a) 143 = 128+15 = SIGTERM from the tool, not a script verdict; (b) the script's own failure paths always print an explicit `ERROR: ...` + diagnostics before exiting 1 — the log had none. By kill time the pairer had confirmed and Moonlight saved the entry; the kill landed during the final `moonlight list` verification. Lesson: don't put sleep/poll phases in the same tool call as the operation; verify *end state* (moonlight list / sunshine_state.json), never wrapper exit codes, before retrying.

## Iteration 21 — AI history + instance cleanup

> good. It works enough for me. Enable Ai history for this session - write it from the beginning - and then destroy our pair test instance / destroy it / make sure to continue updating ai history

### Code changes

None (this history file + instance lifecycle).

### Issues encountered

- `test-instance-scw-pair-check` destroyed cleanly (verified via `scw` inventory: no server/image/snapshot leftovers).
- Destroying `test-instance-scw-plasma-cleanup` failed with "Instance named ... does not exist" (LocalStateSideEffect.loadRawInstanceState): its local state file was already gone AND Scaleway had no leftover images/snapshots/volumes for it — the user had apparently cleaned both sides themselves between turns (I had noticed the empty inventory grep earlier but hadn't dug in). Nothing left to do; lesson: when a destroy says "does not exist", check both state backend and Cloud inventory before assuming an error.
- Remaining known leftover: stale local state file `test-instance-scw-plasma` in `test/integ/.data-root-dir/instances/` (no Cloud resources behind it) — awaiting user decision.
- Ongoing instruction: keep this history file updated as the session continues.

## State at end of session

- Branch `dockerfile-update-plasma-desktop`: 4 new commits (`0b79238`, `4a1e54c`, `ca245c1`, `a9feb7d`), clean tree, image tag `dockerfile-update-plasma-desktop` @ digest `6985ce36` pushed to GHCR.
- All test instances destroyed; Scaleway account clean of test resources.
- Open follow-ups (flagged, not done): `update` command silently drops sunshine flags; stale local state file for destroyed `test-instance-scw-plasma` in `test/integ/.data-root-dir/instances/`; untracked `annonce.md` at repo root.
