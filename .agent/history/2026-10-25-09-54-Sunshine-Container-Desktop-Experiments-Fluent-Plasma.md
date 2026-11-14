# Sunshine container desktop experiments: Fluent XFCE, debug workflow, Plasma X11

Starting from labwc transcripts review, improved the Vagrant debug workflow (single-source-of-truth compose via `sunshine_extra_volumes`), ran a full XFCE + Fluent-Dark theme branch, then a KDE Plasma X11 experiment branch — both built on a reusable "Sunshine 2026 update" base.

## Initial iteration

> see original session transcript in:
>
> session-dockerfile-update-original.md
> session-dockerfile-update.md
> session-init.md
>
> for now just read the transcript to get an idea of what's been done so far. No action needed. Give me a simple summary of what's been done - not too long, just broad summary

Reviewed the three labwc-session transcripts (cursor→opencode migration; labwc+waybar desktop analysis in `container-x-analysis.md`; invisible-cursor root cause = wlroots headless `set_cursor` stub + Sunshine hardcoded `blend_cursor=false`, fixed with a wlroots patch; Vagrant VM debug with tray/CSRF/pairing issues).

### Code changes

None (summary only).

### Issues encountered

None.

## Iteration 2 — Vagrant debug workflow

> give me here the typical workflow to debug the container in VM (workflows, vagrant/docker commands, issues, how internals obtained)

Analysis only: documented the build→save→scp→load→ansible→compose chain, the `nix develop -c vagrant ssh -c "docker exec ..."` nested shell pattern, exec-bit loss via `docker cp`, conf wipe on restart (envsubst re-render), stale `/cloudy/data` pairing state, vagrant/VBox SSH desync across checkouts.

## Iteration 3 — single-source-of-truth dev mounts

> I don't really like having another Compose file. Instead of this, could we adapt our Local Ansible config to automatically deploy our Vagrant compose using the additional mount(s)... Question, no code yet.

### Code changes

Added `sunshine_extra_volumes` (role defaults + compose template loop + dev inventory mounts of overlay bin/conf from `/vagrant`), deleted `test/resources/docker-compose.vagrant.yml`, updated contribution guide debug section, `--force-recreate` in `dev-docker-sunshine-to-vm`.

### Issues encountered

- First template attempt rendered 8-space indentation inside `volumes:` (invalid YAML caught by `go-yaml` in the compose deploy module) — fixed with `trim`-style loop and validated renders with a local jinja2 harness (with and without the variable).
- Fresh-VM deploy failed "No such image: autoheal" because `sunshine_compose_pull_images: never` prevents pulling — pulled the image manually, then disabled autoheal entirely on the dev VM (`sunshine_autoheal_enable: false`) since the deploy force-recreates anyway.
- 5 overlay scripts had no exec bit in the git index → supervisor "not executable" crash loop; fixed with `git update-index --chmod=+x`.
- Whole-tree `conf/sunshine` mount broke boot scripts (they write rendered `sunshine.conf`/`software-rendering.conf` there; vboxsf is uid-1000-owned → read-only for container user). Mount only static items instead (`sunshine.conf.template`, `apps.json`, `assets/`).
- Documented all of this in the infra-feedback-loop skill (initial workflow order, observe/debug commands, footguns) + `--force-recreate` task tweak.

## Iteration 4 — CSRF pairing fix

> I get moonlight error "CSRF Protection Error..." on web UI /pin. See Sunshine doc and community and plan a fix. no code yet, plan only

Diagnosis: two bugs — (1) template lacked trailing newline after `$CLOUDYPAD_SUNSHINE_ADDITIONAL_CONFIG` so `adapter_name` glued onto the same line; (2) duplicate `csrf_allowed_origins` keys (inventory + start script) resolved last-wins, keeping only container IPs, not the VM NAT address.

### Code changes

Newline guard in `start-sunshine.sh`, dedicated `sunshine_csrf_allowed_origins` var (defaults + compose env `CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS`), single-key CSRF line rendered by the start script, origin moved out of `sunshine_additional_config` in dev inventory.

### Issues encountered

Validated the render logic with a local `envsubst`+append simulation before deploying — caught nothing more; pairing worked after re-deploy.

## Iteration 5 — Fluent theme on XFCE (branch `dockerfile-update-fluent-xfce`)

> Let's start simple. Now that we know that we can keep our X base and just update desktop: let's pull master again, create a new branch and do it with Fluent-gtk-theme. Keep the Sunshine update we did on this branch...

### Code changes

New branch from master carrying only the Sunshine-update commits (cherry-picks with labwc-specific hunks dropped: `855ff36` CSRF commit re-resolved for XFCE layout, Sunshine 2026 deb bump), then Fluent-Dark: GTK theme from tagged source via upstream install.sh (no binary release assets exist), `xsettings.xml` (ThemeName/IconThemeName) + `xfwm4.xml` defaults, later + Fluent icons + applicationsmenu plugin + enriched top panel (clock, PulseAudio, systray + `xfce4-pulseaudio-plugin` package).

### Issues encountered

- Cherry-pick conflicts required manual resolution dropping vkms/labwc wiring; a stray older CSRF block tried to re-apply — reverted to the corrected version.
- The Sunshine 2026 version from the labwc branch (`2026.1011.160319`) **did not exist** → 404 on deb download; fetched the real latest tag (`2026.914.233613`) via the GitHub API and fixed the asset-naming pattern (`sunshine_<ver>-1+ubuntu24.04_amd64.deb`).
- VM SSH "Permission denied" after a boot: I had powered on the **wrong checkout's VM** (two `core_default_*` VMs share `vboxnet0`/.43 IP). Diagnosed by matching `.vagrant/machines/default/virtualbox/id` against `VBoxManage list runningvms`; hard-poweroff of the intruder + `vagrant reload` fixed it.
- VM disk full (89%): 4.9G image tar + 14G containerd content from failed layer extractions; wiped `/var/lib/containerd` (reproducible from local build) → clean redeploy.
- Pairing broke again after the image switch: stale `sunshine_state.json` written by Sunshine 2025.924 (`"enabled": "true"` string) vs 2026 boolean parsing → "Client certificate identity is not enabled". Wipe state + forget host in Moonlight = fix. Class of issue: `/cloudy/data` persists old-format state across image updates.
- Fluent icon theme dir is **lowercase `Fluent-dark`** while my default said `Fluent-Dark`; first deploy seeded the persistent xfce4 bind mount with the wrong value — fixed both overlay and live xfconf.
- I used the Fluent repo's `screenshot-blur.jpg` as wallpaper — it was a **Plasma screenshot demo, not a wallpaper**; user rightly reverted; restored the original Cloudy Pad SVG.
- Top bar was empty/black: panel-1 only had a tasklist — added clock/pulseaudio/systray plugins.

## Iteration 6 — VM disk + autostop

> increase vagrant disk size, and restart the vm - autostop service stopped it

### Code changes

None to repo (Vagrantfile already had 100GB); dev inventory `autostop_enable: false`.

### Issues encountered

The VMDK was already 100G but the guest partition (62G) and LV (31G) had never been extended — `growpart` + `pvresize` + `lvextend -l +100%FREE` + `resize2fs` (online) → 97G/75G free. VM was zombie (VBox "running", guest halted): hard `poweroff` + `vagrant up`. Autostop role re-enables the service on ansible runs — the disable must live in the dev inventory, not just `systemctl disable` on the VM.

## Iteration 7 — Plasma experiment (branch `dockerfile-update-plasma-desktop`)

> good - let's go back to our Sunshine update commit and make a new experiment with plasma then on a new branch

### Code changes

New branch from the Sunshine-update base: Plasma 5.27 X11 stack (`plasma-desktop`, `plasma-workspace`, breeze theming, dolphin/konsole/kwrite/kdialog/kde-spectacle/polkit-kde-agent-1), `start-desktop.sh` → `startplasma-x11`, removed XFCE overlay config/scripts (deliberate removal, not addition), persistent plasma config mount in the compose template.

Then (later reverted per user request): `cloudypad-*.desktop` launchers in `/usr/share/applications`, wallpaper to `/usr/share/wallpapers`, `setup-plasma-default-desktop.sh` applying wallpaper + taskbar pins via `org.kde.PlasmaShell.evaluateScript` (qdbus JS API).

Plus final fixes: `kscreenlockerrc` (Autolock=false, LockOnResume=false) in the image overlay; `autostop_enable: false` on this branch too; revert commit `9ef1326` removing the launchers/wallpaper/pins (user: "I don't like the new feel, there's something wrong I can't tell why").

### Issues encountered

- **Stock kwin_x11 works on Xorg-dummy — Selkies' patched kwin is NOT needed.** Their patches target Xvfb/nested cases; our dummy X presents a normal screen. This removes the main maintenance-risk objection to Plasma. Note noble ships Plasma 5.27 (not 6 like Selkies' trixie/26.04 images).
- `plasma-session-x11` doesn't exist in noble (Plasma 6 naming) — session comes from `plasma-workspace` (`startplasma-x11`).
- `spectacle` is `kde-spectacle` in noble.
- **Inline comments inside `apt install -y \` continuation broke the build (exit 127)** — sh comments eat the line continuation; comments must be above the list.
- Host disk filled: the build task re-exports ~6.7G build cache + 5G image tar into `tmp/`; deleted the cache export and pruned 52G of dangling docker images → 64G free.
- VM stopped by autostop again mid-deploy (this branch predated the fluent-branch disable commit) — ported `autostop_enable: false` to this branch's inventory and re-applied.
- Plasma session auto-locked after ~5min (kscreenlocker) locking the user out of a headless streamed desktop — disabled via `kscreenlockerrc` in image overlay (suspend itself is impossible in-container: no logind, powerdevil inert).
- After the defaults additions, user disliked the feel (un-diagnosed) — `git revert 6a18b38` restored the plain Breeze desktop; launchers/wallpaper/pins removed from image and verified gone in the running container.

## Iteration 8 — git state alarm

> did you fucking push on master ???

**I never ran `git push` in this session.** The reflog however showed: `checkout: moving from dockerfile-update-plasma-desktop to master` then `pull: Fast-forward` advancing local master 24f6a4a→a0ac067 (fluent-branch commits) — meaning the **remote master already contained the fluent-branch commits** (pushed outside my actions) and something checked out master and pulled. Repo was left sitting on `master` — a hazard for accidental commits. Recommended switching back to the plasma branch; awaiting user decision on remote master.

### Issues encountered

Lesson: verify branch (`git branch --show-current`) before committing in long sessions; treat `pull`/`checkout` side-effects not present in my own command history as external interference and surface them immediately.

## Final state

- Branch `dockerfile-update-fluent-xfce`: master + Sunshine 2026 (CSRF fix, real tag 2026.914.233613) + Fluent-Dark XFCE + icons + enriched panel. Local only.
- Branch `dockerfile-update-plasma-desktop`: master + Sunshine 2026 + Plasma 5.27 X11 stack (stock kwin, no patches), no autolock, autostop disabled, reverted to plain Breeze. Local only.
- Remote master was moved to a0ac067 by an external push (contains fluent-branch commits) — flagging, untouched by me.
- VM: 97G disk, Plasma image deployed, autostop disabled, no screen lock.
- AGENTS.md has an uncommitted Vagrant-VM-restart doc section.
