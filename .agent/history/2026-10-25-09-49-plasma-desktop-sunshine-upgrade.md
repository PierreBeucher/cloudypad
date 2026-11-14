# Plasma desktop on Sunshine container: launchers, Ubuntu 26 upgrade and image experiments

Deploy and iterate a KDE Plasma desktop stack on the Sunshine container (replacing the XFCE approach), with fast dev feedback loops on the local Vagrant VM, and an Ubuntu 26.04 base upgrade.

## Initial iteration

> See original session transcripts (session-init.md, session-dockerfile-update-original.md, session-dockerfile-update.md): started as .cursor/rules migration and Dockerfile modernization analysis (container-x-analysis.md), then labwc/Wayland experiments, cursor-visible fix, CSRF fixes. Branch `dockerfile-update-labwc-waybar-fuzzel` kept aside; new branch `dockerfile-update-pluent-xfce` then `dockerfile-update-plasma-desktop` created from `docker-update-base` (master + Sunshine 2026 bump + CSRF + dev tooling).

### Code changes

Rebased Plasma branch on docker-update-base; built Plasma X11 stack (no kwin patches needed), validated on local Vagrant VM.

### Issues encountered

- The labwc branch was parked (user felt Wayland desktop was too plain); XFCE + Fluent theme explored on a side branch, then rolled back; final direction = Plasma on Xorg dummy (Selkies pattern).
- VM stopped by autostop service repeatedly → disabled in dev inventory (`autostop_enable: false`) and in-cloud `systemctl disable`.
- VM SSH state desync across multiple checkouts/worktrees (multiple VirtualBox VMs share 192.168.56.x) — must always SSH from the checkout owning the .vagrant machine.

## Iteration 2 — Plasma launchers pinned via config file

> "Now I want to add icons for Steam, Heroic, etc. to the existing desktop"

### Code changes

- `conf/cloudypad/applications/cloudypad-*.desktop` (10 launchers) + XDG_DATA_DIRS env → Plasma discovers them; `setup-plasma-default-desktop.sh` seeds `conf/plasma-default/plasma-org.kde.plasma.desktop-appletsrc` with pins in `[Configuration][General]`.

### Issues encountered

- **Wrong config group**: pinning via `qdbus org.kde.PlasmaShell evaluateScript writeConfig()` writes `launchers` at `[Configuration]` level while icontasks reads from `[Configuration][General]` → all pins rendered as ONE blank broken icon. Root cause of the "single white icon" bug.
- **Stale KSycoca cache**: `~/.cache` persists across container restarts; plasmashell loads the services cache at startup. Fixed by rebuilding `kbuildsycoca5` in `start-desktop.sh` BEFORE starting the session.
- Dev-mount `conf/plasma-default` initially missing from `sunshine_extra_volumes` → added + `CLOUDYPAD_PLASMA_DEFAULT_FORCE` re-seed flag for fast iteration.

## Iteration 3 — dependency upgrade pass

> "let's do a more general upgrade. See docs/src/contributing/maintenance.md. Create tmp/upgrade.md checklist. Skip Wolf."

### Code changes

Bumped (commit f7d1109): nix flake lock, pnpm deps, NVIDIA display driver 595.99.02, datacenter driver 615.71.09, container toolkit 1.20.1-1, Sunshine unchanged (2026.914.233613 latest), Steam unchanged, Lutris 0.5.22, Heroic 2.22.4, GE-Proton GE-Proton11-9, CLI image: pnpm 12.11.2, node 26.12.0-trixie-slim, Pulumi v3.269.0, ansible pip 14.5.0.

### Issues encountered

- Host disk full: `docker image save` in `dev-docker-sunshine-to-vm` failed SILENTLY (task exit 0, VM keeps old image) → added explicit `test -s` + `grep "Loaded image:"` guards to the task.
- `pnpm update` broke TS compile: `@inquirer/prompts` 8.7.3 select() became generic → fixed prompter.ts (default must be a choice value — silently lost the default selection), paperspace generated common.ts needed explicit return type annotation (axios 1.20 request generics), test typed-select-helpers.ts type-inference chain collapsed to `never` → rewrote with direct `string | number` + documented cast.
- nix store full → `sudo nix-collect-garbage -d` freed 94GB.
- Validation: test-compile clean, 155 unit tests passing, image built+deployed, dev VM healthy.

## Iteration 4 — proton_stable default

> "let's have proton stable by default"

### Code changes

`conf/steam/config.vdf` CompatToolMapping `"0"` → `proton_stable` (Steam alias resolving to current stable Proton branch).

### Issues encountered

`proton_stable` verified as a valid Steam client compat tool alias (found references in third-party Steam client tooling); not greppable in installed client binaries — needs behavioral verification by launching Steam.

## Iteration 5 — Ubuntu 26.04 base upgrade

> "can we upgrade to Ubuntu 26 instead of 24? Do it on this branch."

### Code changes

(commit 46ff59b) Base image → `ubuntu:26.04` pinned SHA; Sunshine deb asset → ubuntu26.04; added `plasma-session-x11` + `kwin-x11` (Plasma 6.6.6 naming); start-desktop.sh kbuildsycoca5→6 version-agnostic; launchers `systemsettings5`→`systemsettings`; `--allow-downgrades` on steam-libs.

### Issues encountered

- Steam `steam-libs-i386` downgrades resolute i386 libs → needed `--allow-downgrades` on apt install.
- Plasma 5-format appletsrc seeds and renders fine on Plasma 6 (taskbar icons verified live via pixel-cluster analysis), stock kwin_x11 OK on Xorg-dummy.
- Docker image pushed to `ghcr.io/pierrebeucher/cloudypad/sunshine:dev` (digest sha256:976c5a7...).

## Iteration 6 — current

> "This instance is running with our new image - but it's misbehaving. Inquire why - read only, don't do anything yet" + "enable and write AI history"

### Code changes

Read-only inquiry into misbehaving instance at 172.233.253.30 (AWS, new image deployed): SSH diagnostics only.

### Issues encountered

Investigation in progress.