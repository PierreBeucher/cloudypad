# Sunshine container modernization - analysis for exploration agents

Status: **analysis phase, no code yet**. This document consolidates needs, requirements, current-state analysis, footguns, reference projects (already cloned under `tmp/docker-x/`) and candidate plans. Use it as entry point; explore the listed files for deeper context.

---

## 1. Goal

Modernize the Sunshine server container image (`containers/sunshine/Dockerfile`):

- **Keep**: Sunshine server (Moonlight streaming), Steam/GOG/Epic/Lutris/Heroic launchers and their tooling, user-data persistence and permissions (UID/GID 1001), runtime integration with Ansible deployment.
- **Replace**: the Xorg-dummy + **XFCE4** desktop stack with a more recent, **gaming-friendly full desktop** (desktop is the MAIN solution; Steam Big Picture is an optional additional session, not the only mode).
- **Discard allowed**: XFCE4 configs and data (user decision).
- **Audio**: move PulseAudio → **PipeWire** (decided).
- **Debug**: keep a debugging display option (current dummy Xorg is a debugging facility; whatever replaces it must offer an equivalent).
- **Privileged container**: attempt to drop it; keep if Steam's bubblewrap sandbox can't be satisfied otherwise. Machine is user-owned so security is secondary but hardening is welcome.

## 2. Current state (what exists today)

Image `containers/sunshine/Dockerfile` (base `ubuntu:noble`):

- Full **Xorg** server (`xserver-xorg-*` incl. dummy driver), starts on `DISPLAY=:42` via supervisor.
- Config generated at startup: `xorg-dummy-display.conf` (debug/no-GPU) or `xorg-nvidia-dummy-display.conf` (template + `NVIDIA_PCI_BUS_ID`), keyboard layout via `xorg.conf.d/00-keyboard.conf` template.
- **XFCE4** desktop (`startxfce4`), with default config overlay synced to the bind-mounted config dir (`xfce4-default/` panel launchers, xfconf XML).
- **PulseAudio** (autospawn disabled), dbus system + session buses, **udevd inside container**, supervisor orchestrating: dbus → udev → Xorg → XFCE → Sunshine (see `overlay/cloudy/conf/supervisor/supervisord.conf`).
- **Sunshine** from official `.deb` (v2025.9.24 at time of writing); capture = X11 (default); session resolution applied per-client by `setup-sunshine-screen-mode.sh` (~169 lines of `xrandr` modeline generation, `--newmode/--addmode`, NVIDIA `ForceFullCompositionPipeline`).
- **NVIDIA userspace driver installed at container start** (`setup-nvidia-driver.sh`): downloads matching-version `.run` from NVIDIA, installs with `--no-kernel-modules` etc. Reason: Xorg needs the NVIDIA X driver module.
- Launchers: Steam (official .deb + steam-libs, patched `bin_steam.sh` to avoid desktop shortcut), Lutris, Heroic (with default GE-Proton install `CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION`), Firefox (PPA-pinned non-snap).
- Sunshine apps (`overlay/cloudy/conf/sunshine/apps.json`): Desktop, Steam, Steam (Big Picture), Firefox, Heroic, Epic, GOG, Lutris - each with prep-cmd (`sunshine-app-startup.sh` → resolution + icon-size setup) and detached start/stop scripts (`steam-start.sh`, `heroic-start.sh`, `lutris-start.sh`...).
- Runs as non-root user `cloudy` **UID/GID 1001**; sudoers entry for stop script; healthcheck on Sunshine HTTP API; autoheal sidecar.

### Runtime integration (do not break)

`ansible/roles/sunshine/`:

- `templates/docker-compose.yml`: mounts, ports, env, `privileged: true`, `/dev/uinput` device, `/dev/input` mount, `device_cgroup_rules: c 13:* rmw`, shm_size, autoheal sidecar, keyboard/locale env vars.
- `templates/docker-compose.nvidia.yml`: `runtime: nvidia`, `NVIDIA_DRIVER_CAPABILITIES: all`, `NVIDIA_DRIVER_VERSION` (must match host, read from `/sys/module/nvidia/version`), `NVIDIA_PCI_BUS_ID` (Xorg-format, computed in `tasks/nvidia.yml`), datacenter-GPU resolution cap env (max 2560x1600 for Tesla).
- `defaults/main.yml`: persisted dirs on host:
  - `sunshine_data_dir` → `/cloudy/data` (in-container `XDG_DATA_HOME`: Steam data, Sunshine state/certs, Heroic data, GE-Proton, NVIDIA .run cache)
  - `sunshine_persistent_config_dir` → `/cloudy/conf` (subdirs `xfce4`, `heroic` mounted individually)
  - `sunshine_persistent_home_dir` → `/home/cloudy` (user home: launcher configs, Wine/Proton prefixes)
- Legacy data migration task (`legacy-data.yml`), readiness check script copied to host.
- Deployment: `ansible/sunshine.yml` playbook; dev feedback loop via `task dev-docker-sunshine-to-vm` (Vagrant VM, image save/scp/load) — see Taskfile.yml `dev-ansible-*` tasks.

### Env vars / XDG contract (keep working)

- `CLOUDYPAD_USER=cloudy`, `CLOUDYPAD_USER_HOME=/home/cloudy`
- `CLOUDYPAD_DATA_DIR=/cloudy/data` (= `XDG_DATA_HOME`), `CLOUDYPAD_LOG_DIR`, `CLOUDYPAD_CONF_DIR=/cloudy/conf` (= `XDG_CONFIG_HOME`), `CLOUDYPAD_RUNTIME_DIR=/cloudy/runtime` (= `XDG_RUNTIME_DIR`, currently a plain dir, **not tmpfs** - compose has a TODO)
- `DISPLAY=:42`, `DBUS_SYSTEM_BUS_ADDRESS`, `SUNSHINE_SERVER_NAME`, `CLOUDYPAD_SUNSHINE_ADDITIONAL_CONFIG`, `CLOUDYPAD_SUNSHINE_MAX_BITRATE`
- Keyboard: `CLOUDYPAD_KEYBOARD_LAYOUT/MODEL/VARIANT/OPTIONS` → today templated into Xorg `00-keyboard.conf`; must remap to whatever the new stack uses (xkbcommon `XKB_DEFAULT_*` env for Wayland compositors)
- `CLOUDYPAD_LOCALE`, `CLOUDYPAD_SCREEN_MAX_WIDTH/HEIGHT` (datacenter GPU cap), `NVIDIA_ENABLE`, `NVIDIA_DRIVER_VERSION/TYPE/PCI_BUS_ID`

## 3. Footguns in current approach (with user resolutions)

| # | Footgun | User decision |
|---|---|---|
| 1 | Dummy Xorg = software framebuffer; GPU-acceleration limited; CPU capture | Must keep a **debug display option** in the replacement stack (X or Wayland) |
| 2 | 169-line xrandr modeline script (`setup-sunshine-screen-mode.sh`) is fragile | Do not fix specifically, but update/replace as needed by the new option (resolution handling may become native) |
| 3 | NVIDIA `.run` install at every container start; brittle host-version matching | **Retest NVIDIA Container Toolkit** (driver libs mounted instead of installed). Past issue: permission on `/dev/nvidia-caps/*` and nvidia devices in container - see git history (`62879a0` "ensure required NVIDIA driver capabilities") and `ansible/roles/nvidia-driver/files/nvidia-setup-devices.sh` (host-side service creating `/dev/nvidia-modeset` + caps devices). Wolf role (`ansible/roles/wolf/templates/docker-compose.nvidia.yml`) instead bind-mounts `/dev/nvidia*` + caps devices directly + `nvidia-driver-vol` - an existing fallback pattern to reuse |
| 4 | PulseAudio legacy | Replace with **PipeWire** (`pipewire` + `pipewire-pulse` for Steam compat + `wireplumber`) |
| 5 | XFCE4 dated, X11-only, panel XML maintenance | **Replace entirely** (configs/data discardable) |
| 6 | `-ac` Xorg (no auth) | Free to keep or discard, whatever is cleanest |
| 7 | `DISPLAY=:42` + Xorg lock-file cleanup hacks | Cleaner approach welcome |
| 8 | `privileged: true` (required today for Steam bwrap sandbox + udevd) | Try to disable; if not feasible keep privileged (machine is user-owned) |

Other observations: X11 capture implies CPU copy of framebuffer; Steam runs windowed over desktop (focus fights); udevd-in-container exists mostly for input devices (Sunshine injects input via `uinput` itself).

## 4. Reference projects (cloned, local)

All cloned (shallow) under `tmp/docker-x/`:

| Directory | Upstream | Role in analysis |
|---|---|---|
| `tmp/docker-x/selkies/` | selkies-project/selkies | **Primary blueprint**: base container with Xvfb-glamor+DRI3 X server, headless Wayland backend (labwc), PipeWire, s6 supervision, fake-udev |
| `tmp/docker-x/docker-selkies-egl-desktop/` | selkies-project/docker-selkies-egl-desktop | KWin/Plasma on Selkies - shows KWin requires **source rebuild + patches** (why Plasma is expensive) |
| `tmp/docker-x/docker-selkies-glx-desktop/` | selkies-project/docker-selkies-glx-desktop | Full Xorg-in-container owning the GPU (GLX variant) |
| `tmp/docker-x/podstage/` | slooock-dev/podstage | Rootless **Podman** + gamescope + labwc + Sunshine/Moonshine; proves unprivileged Steam and NVIDIA lib discovery |
| `tmp/docker-x/gow/` | games-on-whales/gow | GOW app images + `images/base-app`: sway/waybar desktop mode + gamescope console mode behind env flags |
| `tmp/docker-x/docker-steam-headless/` | Steam-Headless/docker-steam-headless | All-in-one Xorg-dummy + XFCE + Sunshine container (the incumbent pattern) |
| `tmp/docker-x/KasmVNC/`, `tmp/docker-x/workspaces-core-images/` | kasmtech | KasmVNC X-server-with-web-streaming (alternative client path, not core to current plan) |
| `tmp/docker-x/docker-ubuntu-desktop/` | gezp/docker-ubuntu-desktop | X server in container + VirtualGL EGL GPU accel (no `/tmp/.X11-unix`) |
| `tmp/docker-x/docker-baseimage-gui/` | jlesage/docker-baseimage-gui | Minimal GUI-app container base |
| `tmp/docker-x/dockerfile-x11docker-xserver/`, `tmp/docker-x/dockerfile-x11docker-xwayland/`, `tmp/docker-x/x11docker/` | mviereck | X server itself containerized; toolbox documenting every X/Wayland-in-container combination |
| `tmp/docker-x/neko/` | m1k1o/neko | Xorg/Xvfb in container + GStreamer WebRTC (multi-user pattern) |

### Key technical constraints learned (capture architecture decides the compositor)

- Sunshine capture backends: **x11**, **kms** (needs real DRM master - unavailable on container render nodes), **wlr** (wlroots-screencopy: works with **labwc, sway**; Hyprland implements the protocol itself).
- **KWin/Mutter are NOT wlroots** → Sunshine cannot capture them in-container (hence Selkies rebuilding KWin). This rules out Plasma/GNOME for a Sunshine-captured desktop.
- **gamescope** is not directly capturable by Sunshine → podstage nests gamescope **under labwc** (labwc = capture target).
- gamescope gives: virtual output auto-resized to client resolution, XWayland for Steam, fullscreen gamepad-first UX.
- Steam: all references run Steam via XWayland; native Wayland exists (2025+) but experimental.
- NVIDIA in containers: NVIDIA Container Toolkit mounts driver userspace (incl. X driver module + GLX server lib) when `NVIDIA_DRIVER_CAPABILITIES=all` - Selkies glx-desktop (Xorg) and podstage (`libglxserver_nvidia.so` candidates list in `src/podstage/core/runtime.py`) both rely on it. NVIDIA Wayland requires driver ≥555 (explicit sync) - current datacenter drivers qualify.
- podstage runs **rootless** (`userns=keep-id` + custom seccomp profile allowing `kcmp`); its `seat-shim.c` solves rootless labwc issues (seat naming, cursor, udev hotplug without uevents).
- Packaging note (Ubuntu noble = current base): **sway packaged; labwc and Hyprland NOT in noble** → build from source (Selkies ships `build-labwc.sh`) or move base (trixie / newer Ubuntu, as Steam-Headless did with Debian trixie).

## 5. Requirements summary for the new stack

1. Main session = **full desktop** (window management, panel, launcher), gaming-friendly.
2. Steam Big Picture = **optional** additional session (Sunshine app entry), layered on the desktop stack.
3. Sunshine capture must work in-container (→ wlroots-family compositor, or keep X11 path).
4. Keep: Sunshine + apps.json app set + prep/detached scripts semantics, Steam/Proton (i386 multiarch), Heroic+GE-Proton, Lutris, GOG, Epic, Firefox.
5. Retrocompat mounts: `/cloudy/data` (=XDG_DATA_HOME), `/home/cloudy`, Heroic conf - unchanged paths and **UID/GID 1001**.
6. XFCE configs/mount dropped; optionally an Ansible task cleans stale `conf/xfce4` on host.
7. PipeWire replaces PulseAudio (keep `pipewire-pulse` Steam compat).
8. Keyboard layout/model/variant/options env must keep working (→ `XKB_DEFAULT_*` for Wayland).
9. Keep a debug display mode (Xvfb-glamor is the modern equivalent of dummy-Xorg; can be parked/selected by env).
10. Resolution per client session without the modeline script (compositor virtual-output resize, or gamescope dynamic res).
11. Retest NVIDIA Container Toolkit; fallback = direct device mounts + host `nvidia-setup-devices.sh` (existing).
12. Attempt unprivileged (Steam bwrap, no udevd → fake-udev); keep `privileged` if blocked.
13. Supervisor program list updated (dbus, pipewire+wireplumber+pipewire-pulse, compositor session, sunshine, healthcheck); keep healthcheck/autoheal/ports wiring.
14. `XDG_RUNTIME_DIR` must become a proper **tmpfs** (Wayland hard requirement; compose TODO exists).

## 6. Desktop options evaluated

| # | Stack | Gaming UX | Sunshine capture | Precedent | Notes |
|---|---|---|---|---|---|
| A | **labwc + waybar + fuzzel** (main proposal) | Very good: floating-first, mouse-driven, fullscreen-friendly, lean (~50-100MB RAM) | **wlr native** | Selkies (default session compositor), podstage (Sunshine backend) | Self-assembled shell; labwc not in noble → build or move base |
| B | **sway + waybar + fuzzel** | Moderate: tiling-first, keyboard-centric (GOW's production desktop) | **wlr native** | GOW base-app (production, patched Xwayland, xdg-desktop-portal) | sway packaged in noble = lowest friction; floating UX needs config care |
| C | KDE Plasma / KWin headless | Comfortable, heavy | ❌ (KWin rebuild + patches required) | Selkies egl-desktop | Ruled out by capture architecture |
| D | GNOME / Mutter | Comfortable | ❌ portal screencast only | none | Ruled out |
| E | Hyprland | Good gaming features (tearing), eye-candy, tiling+floating | wlr-screencopy implemented (validate) | **zero streaming-container precedent** | Bleeding-edge churn, NVIDIA history, not in noble, own build chain |
| F | Wayfire / river / COSMIC | Niche | partial | none | Ruled out (early/niche) |
| G | Xvfb-glamor + openbox | X11-era | x11 (current) | Selkies Xvfb service | Fallback/debug role only |

Orthogonal add-ons (any option): gamescope-nested Big Picture session (podstage/GOW pattern); Xvfb-glamor parked debug backend (Selkies pattern - Xvfb service sleeps when Wayland backend active).

## 7. Candidate plans

**Plan 1 (recommended): labwc + waybar + fuzzel main desktop, phased**

- Phase 1: swap display server to labwc (wlroots) session; waybar panel; fuzzel launcher; XWayland for all apps; Sunshine capture = `wlr`; virtual-output resize replaces modeline script; PipeWire stack; keyboard via `XKB_DEFAULT_*`; drop udevd (fake-udev); drop PulseAudio; keep XFCE-off; retrocompat mounts untouched.
- Phase 2: gamescope-nested "Steam (Big Picture)" app entry (optional session); Xvfb-glamor debug backend behind env flag.
- Phase 3 (stretch): attempt unprivileged (podstage-style seccomp/userns), NVIDIA Container Toolkit retest with direct-mount fallback.

**Plan 2 (variant of Plan 1): same but sway** as session compositor - lowest packaging friction on noble, GOW production precedent, tiling UX tradeoff.

**Plan 3 (exploratory variant): Hyprland** as compositor behind the same session flag - eye-candy, needs validation spike (capture + NVIDIA datacenter GPUs) and source build.

**Plan 4 (conservative fallback): keep X11 path** - Xvfb-glamor + openbox, modeline-free via RandR resize; modernizes GPU path only; UX unchanged. Use only if Wayland path hits a wall.

Not pursued: Wolf/gst-wayland-display replacement of Sunshine (different product); Plasma/GNOME (capture mismatch); dockur/windows VM-in-container (different boundary).

## 8. Key files to explore (context engineering)

### In this repo (cloudypad core)

- `containers/sunshine/Dockerfile` - the image being modernized (packages, stages, ENV contract)
- `containers/sunshine/overlay/cloudy/entrypoint.sh` - container entrypoint (supervisor launch)
- `containers/sunshine/overlay/cloudy/conf/supervisor/supervisord.conf` - service orchestration to rewrite
- `containers/sunshine/overlay/cloudy/bin/` - all setup/start scripts, notably:
  - `setup-all.sh` (startup orchestration), `setup-dirs.sh` (mounts/permissions, UID 1001)
  - `setup-x-config.sh` + `conf/x11/*` (Xorg/NVIDIA/keyboard templating - keyboard must be remapped)
  - `start-x-server.sh`, `wait-x-availability.sh` (debug display, readiness pattern)
  - `start-desktop.sh` (XFCE launch + dbus session export)
  - `start-sunshine.sh` + `conf/sunshine/sunshine.conf.template` (state persistence paths, creds)
  - `setup-sunshine-screen-mode.sh` (modeline script to replace)
  - `setup-nvidia-driver.sh` (NVIDIA .run install - candidate for removal via toolkit/mounts)
  - `setup-user.sh` (device groups for /dev/input, /dev/dri, uinput)
  - `apps.json` consumers: `steam-start.sh`, `steam-stop.sh`, `heroic-start.sh`, `heroic-stop.sh`, `lutris-start.sh`, `lutris-stop.sh`, `sunshine-app-startup.sh`, `export-dbus-address.sh`
  - `setup-container-post-start.sh`, `sunshine-healthcheck.sh`, `setup-sudo.sh`, `stop-*` scripts
- `containers/sunshine/overlay/cloudy/conf/sunshine/apps.json` - app definitions to keep/extend (Big Picture entry)
- `containers/sunshine/overlay/cloudy/conf/xfce4-default/` - XFCE defaults (to discard; shows panel/wallpaper customization approach)
- `ansible/roles/sunshine/templates/docker-compose.yml` + `docker-compose.nvidia.yml` - mounts, devices, env contract
- `ansible/roles/sunshine/tasks/main.yml`, `tasks/nvidia.yml`, `tasks/legacy-data.yml`, `defaults/main.yml`, `vars/main.yml`
- `ansible/roles/nvidia-driver/files/nvidia-setup-devices.sh` - host-side NVIDIA device nodes service (caps/modeset)
- `ansible/roles/wolf/templates/docker-compose.nvidia.yml` - direct `/dev/nvidia*` + caps device-mount fallback pattern
- `ansible/sunshine.yml` - playbook wiring
- `Taskfile.yml` - `dev-docker-sunshine-to-vm`, `dev-ansible-config`, `build-sunshine-container-local` (Vagrant dev feedback loop)
- Git history: `62879a0` (NVIDIA_DRIVER_CAPABILITIES fix), `c344a4d` (datacenter drivers), `02aab20` (PCI bus ID autodetect), `86fd37a` (Tesla resolution cap) - context for NVIDIA constraints

### Reference repos (under `tmp/docker-x/`)

- `tmp/docker-x/selkies/addons/base/` - **the core blueprint**:
  - `services/xvfb/run` - Xvfb-glamor+DRI3 startup: GPU render-node selection, NVIDIA/AMD/Intel/software fallback, stale-lock cleanup, readiness probe via `xdpyinfo`, `xhost SI:localuser` auth, "parks" when Wayland backend active
  - `services/wayland/run` - headless labwc session compositor (nested), socket detection, `WLR_BACKENDS=wayland`
  - `services/{dbus,pipewire,pipewire-pulse,wireplumber,coturn}/run` - service supervision patterns
  - `container-entrypoint.sh` - backend selection (`SELKIES_WAYLAND`), compositor choice, `XDG_SESSION_TYPE`/`GDK_BACKEND` export
  - `build-labwc.sh` + `labwc-rc.xml` - labwc source build (noble gap) + config
  - `addons/fake-udev/` (from upstream repo layout) - udev-less input hotplug
  - `Dockerfile` - full base image assembly
- `tmp/docker-x/docker-selkies-glx-desktop/Dockerfile` - full Xorg on mounted NVIDIA drivers (no .run install)
- `tmp/docker-x/docker-selkies-egl-desktop/Dockerfile` - KWin source rebuild + patches (evidence of Plasma cost)
- `tmp/docker-x/podstage/`:
  - `containers/runtime/{entrypoint.sh,runner.sh,resize.sh,labwc-rc.xml,seat-shim.c}` - labwc session + gamescope + rootless solutions
  - `src/podstage/core/runtime.py` - gamescope/Sunshine env wiring, NVIDIA lib discovery lists (`_GLXSERVER_CANDIDATES`), seccomp profile for kcmp
  - `src/podstage/core/doctor.py` - rootless checks (userns, seccomp, kcmp)
- `tmp/docker-x/gow/images/base-app/build/Dockerfile` + `scripts/launch-comp.sh` + `configs/` - **session-switch pattern** (`RUN_GAMESCOPE` vs `RUN_SWAY`), sway+waybar desktop, patched Xwayland, resolution via compositor config
- `tmp/docker-x/docker-steam-headless/Dockerfile.debian` + `overlay/usr/bin/start-xorg.sh` + `overlay/etc/cont-init.d/*` - incumbent all-in-one pattern (Xorg dummy, XFCE, Sunshine, VNC, udev/dbus init ordering)
- `tmp/docker-x/docker-ubuntu-desktop/` - VirtualGL EGL GPU accel in container (no host X socket)
- `tmp/docker-x/dockerfile-x11docker-xserver/` - X servers containerized (reference for X11 debug backend)

## 9. Validation checklist (before coding)

- [ ] Sunshine `wlr` capture against long-running labwc session (Desktop + windowed apps) - podstage proves gamescope sessions, Selkies proves long-lived wlroots sessions (with their own client)
- [ ] Steam windowed + Big Picture on XWayland under labwc; gamepad input via Sunshine uinput
- [ ] Heroic/Electron apps under Wayland (XWayland ok, `GDK_BACKEND` fallback)
- [ ] NVIDIA: toolkit retest (driver mounts incl. X module / GLX server lib); fallback to direct device mounts (wolf pattern) + `nvidia-setup-devices.sh`
- [ ] AMD/Intel + no-GPU software fallback path (Xvfb-glamor/llvmpipe)
- [ ] PipeWire: Steam audio via `pipewire-pulse`; Sunshine PipeWire capture
- [ ] Keyboard layout env remap (`XKB_DEFAULT_*`) verified against existing `CLOUDYPAD_KEYBOARD_*` values
- [ ] Mounts: `/cloudy/data` (Steam `config.vdf` Proton-global patch still applied), `/home/cloudy`, Heroic; UID/GID 1001 ownership after first boot
- [ ] Datacenter GPU resolution cap env still honored (2560x1600 Tesla cap)
- [ ] Healthcheck + autoheal + ports unchanged; readiness probes target new display (`xdpyinfo` or `wayland-info`)
- [ ] `XDG_RUNTIME_DIR` as tmpfs in compose; Wayland socket cleanup on restart
- [ ] Steam bwrap sandbox: privileged vs seccomp/userns experiment
- [ ] Base image decision: stay on `ubuntu:noble` (build labwc) vs move to Debian trixie / newer Ubuntu (packaged labwc) - Sunshine `.deb` availability per distro must be checked
- [ ] Remove `xfce4` mount from compose + optional Ansible cleanup of stale `conf/xfce4`
- [ ] i386 multiarch package set preserved exactly (Steam/Proton)