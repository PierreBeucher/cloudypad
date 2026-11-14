# Plasma desktop on Sunshine container: launchers, dev feedback loops, session upkeep

Multi-day session spanning: recap of previous Dockerfile-update experiments, dev-VM workflow hardening (compose mounts, AGENTS/skills docs), the Fluent-XFCE theme branch, then the Plasma-on-Xorg experiment branch with task-manager launcher pinning, a hard-to-diagnose "single white icon" Plasma bug, and a fast dev feedback loop for Plasma configs. Companion file `2026-10-25-09-49-plasma-desktop-sunshine-upgrade.md` continues this arc (upgrade pass, proton_stable, Ubuntu 26.04).

## Initial iteration

> "see original session transcripts... give me a simple summary of what's been done"

Read-only recap of session-init.md / session-dockerfile-update-*.md: previous work was `.cursor/rules` migration, labwc/Wayland stack + invisible-cursor wlroots fix, Sunshine 2026 bump + CSRF. Also answered: typical Vagrant/Docker debug workflow used (vagrant ssh → docker exec chains, docker cp exec-bit footgun, config regeneration wipes, /cloudy/data persistence, checkout-desync of .vagrant).

### Issues encountered

None (analysis only). Produced a mental model reused for the whole session: state lives in `/cloudy/data` (persists), configs are re-rendered at boot (envsubst), dev VM has one VirtualBox machine per checkout.

## Iteration 1 — dev compose mounts replace test/resources/docker-compose.vagrant.yml

> "could we adapt our Local Ansible config to automatically deploy our Vagrant compose using the additional mount(s)... single source of truth?"

### Code changes

`sunshine_extra_volumes` role var (defaults empty) rendered into `ansible/roles/sunshine/templates/docker-compose.yml`; dev inventory mounts overlay `bin/` + default conf trees from `/vagrant` into the container. Deleted `test/resources/docker-compose.vagrant.yml`. Contribution guide debug section rewritten around `task dev-ansible-config` + `docker restart cloudy`.

### Issues encountered

- Jinja loop in compose template emitted 8-space indents → invalid YAML; fixed with `{% for %}` whitespace control. Validated both empty/populated render via python jinja2 + YAML parse.
- The ansible role only runs `-t sunshine-docker` in `dev-docker-sunshine-to-vm`: does NOT install Docker → documented mandatory full `dev-ansible-config` on first provisioning; task force-recreate added.
- Fresh VM misses autoheal image (pull policy `never`) → disabled autoheal on dev (`sunshine_autoheal_enable: false`).
- Overlay scripts missing exec bits in git → `git update-index --chmod=+x`.
- Whole-tree mount of `conf/sunshine` broke boot (start scripts write rendered configs there) → per-file mounts only (`sunshine.conf.template`, `apps.json`, `assets/`).

## Iteration 2 — CSRF pairing fix (Sunshine 2026)

> "I get this error: CSRF Protection Error... on web UI"

### Issues encountered

Two bugs: (1) `envsubst` template had no trailing newline → inventory `csrf_allowed_origins` glued with `adapter_name` line; (2) start-sunshine.sh appended a SECOND `csrf_allowed_origins` key (last-key-wins) with only localhost+container IPs, missing the VM LAN IP unreachable from inside NAT. Fix: newline guard + single-key rendering merging localhost + `hostname -I` IPs + new `CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS` env from `sunshine_csrf_allowed_origins` var. Root cause understanding of "client not authorized" pairing errors: stale `sunshine_state.json` from old Sunshine version (persistent bind mount) → rm + forget host in Moonlight + re-pair.

## Iteration 3 — Fluent theme on XFCE, then rollback and Plasma decision

> "couldn't we support a few of those [themes]?" → "let's start simple... Fluent-gtk-theme" → "I don't like the new feel. Rollback" → "let's go back to our Sunshine update commit and make a new experiment with plasma"

### Code changes

Branch `dockerfile-update-fluent-xfce` from master with cherry-picked Sunshine-update commits (resolved conflicts keeping XFCE paths): Fluent-Dark GTK + Fluent icons + blurred wallpaper (reverted: it was the repo's example *screenshot*, not a wallpaper) + panel enrichment (clock/volume/tray). Then branch `dockerfile-update-plasma-desktop` from the Sunshine-update base: Plasma 5.27 X11 packages (noble = Plasma 5, no `plasma-session-x11` package; `spectacle`→`kde-spectacle`), `start-desktop.sh` → `startplasma-x11`, xfce overlays/scripts removed.

### Issues encountered

- Inline comments inside `apt install` continuation list → exit 127 (comments can't continue a backslash list).
- Sunshine version tag from the labwc branch (2026.1011.160319) doesn't exist → 404; fixed to real latest `2026.914.233613`.
- Host disk full → `docker image save` failed SILENTLY (task exit 0, VM kept old image) — later fixed with task guards.
- VM disk: Vagrantfile provisions 100GB but guest LV ships 31G → `growpart/pvresize/lvextend/resize2fs`.
- Stock `kwin_x11` works fine on Xorg-dummy (Selkies' patched kwin is for Xvfb/nested cases) → zero patch surface.
- autostop killed the dev VM repeatedly → `autostop_enable: false` everywhere + `kscreenlockerrc` (Autolock=false) since a locked session locks the user out of their own instance.

## Iteration 4 — Cloudy Pad launchers on Plasma task manager

> "add icons for Steam, Heroic, etc. to the existing desktop... can we do by just updating the overlay without rebuilding?"

### Code changes

Overlay `conf/cloudypad/applications/cloudypad-*.desktop` (Steam/Epic/GOG/Heroic/Lutris/Files/Keyboard/Mouse/Help/Exit) discovered via `XDG_DATA_DIRS=/cloudy/conf/cloudypad:...` (Dockerfile ENV + compose env); `setup-plasma-default-desktop.sh` pins them to the task manager.

### Issues encountered

- **First attempt (JS API) rendered ONE blank white icon.** Verified config string stored, icons resolvable (PyQt QIcon.fromTheme test), services in sycoca — yet rendering broken. Pixel analysis misled me once (everything non-black on Breeze wallpaper); user rightly challenged "what makes you think it works?"
- Root causes: (a) stale KSycoca cache — `~/.cache` persists, plasmashell loads service cache at startup → `kbuildsycoca5` moved into `start-desktop.sh` BEFORE `startplasma-x11`; (b) **the real killer**: `evaluateScript writeConfig('launchers')` writes to applet `[Configuration]` level, but icontasks reads `[Configuration][General]` → our pin landed in a dead key, real one left empty → single broken icon. My JS-API readConfig check "confirming" the pins was reading the dead key.
- Final fix: static `conf/plasma-default/plasma-org.kde.plasma.desktop-appletsrc` (captured from Plasma's own layout, pins in the correct `[General]` group) seeded by the setup script — committed `ad123fd`.

## Iteration 5 — fast feedback loop on Plasma configs

> "The new iteration is having the possibility to have fast feedback looping dev for Plasma configs... not having to do a full rebuild"

### Code changes

Mount `conf/plasma-default/` via `sunshine_extra_volumes`; `CLOUDYPAD_PLASMA_DEFAULT_FORCE` env (var `sunshine_plasma_default_force`, default false) makes the seed script re-seed the persistent appletsrc at every container start in dev; prod keeps seed-once semantics. Committed `8f32ecb` (after user explicitly reminded: NEVER commit on master — an incident occurred where a parallel session had fast-forwarded local master to include fluent-branch commits pushed by someone else; investigated via reflog, confirmed I never pushed).

### Issues encountered

- Jinja `{% if %}` blocks in compose template: two rounds of indentation bugs (block tags eat indentation / glue comments). Solved with `ternary()` inline filter — an Ansible filter, not plain Jinja2 (my python-jinja validation harness couldn't render it; validated by real ansible deploy).
- Validated the loop end-to-end: overlay appletsrc edit (added dolphin pin) → `docker restart cloudy` → edit landed in live config, no rebuild.

## Iteration 6 — panel size experiment + rollback, upgrade checklist

> "just do the increase of desktop icon size for now - controlled via config" → "this doesn't seem to work. Rollback the icon size change only, and relaunch dev VM. note: we just reboot our host machine"

### Code changes

Panel-size attempt: `__CLOUDYPAD_PLASMA_PANEL_SIZE__` placeholders (panel `thickness` + kickoff `iconSize`) + sed substitution in seed script + env wiring. Didn't visually work → rolled back exactly those files (appletsrc placeholders, seed-script substitution, compose/Dockerfile env), keeping the feedback-loop changes. Host had been rebooted → VM booted clean per documented procedure (`vagrant up`, guest IP poll 15s).

Created `tmp/upgrade.md` checklist from `docs/src/contributing/maintenance.md` (Wolf skipped), with current pinned versions inline: Sunshine 2026.914.233613, Steam 1.0.0.81, Lutris 0.5.20, Heroic 2.19.1, GE-Proton10-32, NVIDIA display 595.58.03 / datacenter 590.48.01 / toolkit 1.19.0-1, base noble-20260210.1, node 25.6.1-trixie-slim, pnpm 10.33.3, Pulumi v3.221.0.

## Key operational learnings (documented in AGENTS.md + infra-feedback-loop skill)

- VM zombie states: `VBoxManage controlvm poweroff` → `startvm --type headless` → poll guestproperty IP; `vagrant status` lies across boots.
- Silent deploy failure on full host disk — task now guards (`test -s` tarball, `grep "Loaded image:"`).
- Per-checkout VirtualBox machines on shared 192.168.56.x: run vagrant/SSH from the owning checkout.
- VM guest LV grows once per fresh VM (Vagrantfile 100GB provision vs 31G shipped).
- Stale Sunshine pairing across image bumps: rm sunshine_state.json + forget host client-side.
