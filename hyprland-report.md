# Hyprland Sunshine image experiment - status report

Status at time of writing: **image build in progress, blocked at Hyprland cmake configure hang** (fix pushed, rebuild was running when work paused). Read `container-x-analysis.md` first for the full architecture analysis and context (also committed on branch).

Branch: `dockerfile-update` on `github.com/PierreBeucher/cloudypad` (origin). All work committed and pushed up to commit "wip: shared abseil + flattened re2.pc (pkgconf 1.8 infinite loop on combined requires)".

Remote test machine: `172.232.33.143` (SSH as root). NVIDIA RTX 4000 Ada, driver 590.48.01, docker 29.9.0. It is a Cloudy Pad VM (NVIDIA + docker preinstalled). Repo cloned at `/opt/cloudypad-core` (branch `dockerfile-update`). NOTE: this machine rebooted twice during the session (cause unknown - watch for `uptime` when reconnecting; build logs live in `/tmp` and vanish on reboot).

---

## 1. What we did

### Goal
Replace the XFCE4/Xorg desktop in `containers/sunshine/Dockerfile` with a modern Wayland stack: **Hyprland** compositor (headless, virtual outputs) + xwayland-satellite + PipeWire, keeping Sunshine, Steam/Lutris/Heroic and all user-data mounts retrocompatible (UID/GID 1001, `/cloudy/data`, `/home/cloudy`, Heroic conf). XFCE configs are discarded by design.

### Files created/modified (all committed)
- `containers/sunshine/Dockerfile.hyprland` - new variant image (does not touch the existing XFCE `Dockerfile`). Base `ubuntu:noble`, same Sunshine/Steam/Lutris/Heroic debs as main image.
- `containers/sunshine/overlay/cloudy/` additions (additive only, XFCE image untouched):
  - `entrypoint-hyprland.sh`, `bin/setup-all-hyprland.sh`, `bin/setup-hyprland-config.sh`
  - `bin/start-hyprland.sh`, `bin/start-seatd.sh`, `bin/start-pipewire.sh`, `bin/start-pipewire-pulse.sh`, `bin/start-wireplumber.sh`, `bin/start-dbus-session.sh`, `bin/wait-wayland-availability.sh`
  - `conf/hypr/hyprland.conf.template` (envsubst'd keyboard layout/variant/model/options + headless output creation + xwayland-satellite + waybar autostart)
  - `conf/supervisor/supervisord-hyprland.conf` (dbus, dbus-session, udev, seatd, pipewire, pipewire-pulse, wireplumber, hyprland, sunshine, post-start)
- Modified (shared, backward-compatible):
  - `bin/setup-sunshine-screen-mode.sh`: Wayland branch via `hyprctl keyword monitor` when `WAYLAND_DISPLAY` is set (replaces the xrandr modeline path); X11 path unchanged
  - `bin/setup-xfce4-desktop-icon-size.sh`: skips when `xfconf-query` absent (non-XFCE image)
- `test/resources/docker-compose.hyprland-local.yml` - local debug compose (privileged, `/dev/uinput`, Sunshine ports 47984-48002, data dirs under `./tmp/sunshine-local/`, no NVIDIA)
- `container-x-analysis.md` - full architecture analysis (options A-G, validation checklist, key files)

### What the image contains (design decisions, all verified against source/docs)
- **Hyprland v0.56.2** built from source (not packaged in Ubuntu noble; needs C++26 -> clang-20 packaged in noble + cmake>=3.30 via pip)
- Headless operation: aquamarine headless backend is mandatory in Hyprland startup; `AQ_NO_KMS_REQUIREMENT=1` (exported in `start-hyprland.sh`) allows render-only GPUs (datacenter NVIDIA = "3D controller", no display output); virtual display via `hyprctl output create headless cloudypad` (wiki explicitly recommends this for Sunshine servers); per-session resize via `hyprctl keyword monitor` replaces the xrandr modeline script
- **xwayland-satellite v0.8.3** for X11 apps (Steam etc.), `DISPLAY=:0`
- **PipeWire + pipewire-pulse + wireplumber** (replaces PulseAudio), dbus session bus as its own supervisor service (`dbus-session`, address file `$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address` kept for retrocompat with `export-dbus-address.sh`)
- **seatd** (root, socket group `video`) for libseat session (compositor input), plus existing udevd for Sunshine's uinput virtual devices
- Sunshine capture: `wlr` (wlroots-screencopy) expected to work against Hyprland (Hyprland implements wlr-screencopy) - NOT yet validated end to end
- Build strategy: everything installed to `/usr/local`; main stage `COPY --from=build-deps-ready /usr/local/` + `/etc/ld.so.conf.d/999-cloudypad-local.conf` (with `/usr/local/lib/x86_64-linux-gnu`) + ldconfig so our libs shadow Ubuntu's same-SONAME ones

### Dependency build chain (all built successfully as of latest commit)
Order: hyprutils -> hyprlang -> hyprcursor -> hyprgraphics -> aquamarine -> Hyprland -> xwayland-satellite, plus supporting builds. All pinned tags:
- toml++ v3.4.0 (header-only; Ubuntu's libtomlplusplus is GCC-ABI, conflicts with libc++) + hand-written `/usr/local/lib/pkgconfig/tomlplusplus.pc` (no `-l`, no Requires) because upstream toml++ installs NO pkgconfig file and pkg-config would otherwise resolve Ubuntu's
- hyprwayland-scanner v0.4.6
- libdisplay-info from git main pinned `62a9346c3dce2bddba1d4dc186949e4320d6f801` (aquamarine 0.15 needs HDR/colorimetry APIs not in any release; 0.4.0 insufficient)
- libinput 1.32.0 (noble 1.25 < required 1.26; aquamarine needs >=1.26, Hyprland >=1.29); meson flags `-Dlibwacom=false` etc (feature options take true/false here)
- libei 1.6.0 (libeis-1.0 requires libei >= 1.3, noble has 1.2.1); meson `-Dtests=disabled -Dsd-bus-provider=auto`, needs `libsystemd-dev` + `python3-jinja2`
- libxkbcommon xkbcommon-1.13.2 (noble 1.6.0, Hyprland needs >=1.11); options `-Denable-tools=false -Denable-bash-completion=false` (NOT `enable-cli`/`enable-tests`); needs bison; needs meson >= 1.4 (pip `pip3 install -U meson`)
- wayland 1.26.0, wayland-protocols 1.49 (noble too old: 1.22.0 / 1.45)
- libxcb-errors from source (autotools, NOT meson; needs `--recurse-submodules` for util-macros, `xutils-dev autoconf automake libtool`, `xcb-proto`)
- lua 5.5.1 from lua.org tarball (github mirror lacks build system) + hand-written `lua5.5.pc` (upstream ships no .pc; Hyprland needs lua>=5.5, noble has 5.4)
- abseil-cpp 20240722.0 built SHARED with libc++ (re2 hard-requires external abseil; tag naming no longer has `LTS_` prefix; needs `-DBUILD_SHARED_LIBS=ON`)
- re2 2024-07-02 built with libc++ (Ubuntu's libre2 is GCC-ABI -> undefined `std::__1` refs); **re2.pc flattened by hand** (see problem 9)
- muparser v2.3.5 with libc++ (needs `libomp-20-dev` for its OpenMP requirement)
- hyprwire v0.3.1 (new hyprwm lib, Hyprland v0.56 dep)
- Toolchain: clang-20 + libc++-20 (both in noble repos), `pip3 install -U cmake meson` (`-U` required - apt meson 1.3.2 would otherwise satisfy pip), `bison` (xkbcommon), `pkgconf`
- Build env: `ENV CC=clang-20 CXX=clang++-20 CXXFLAGS="-stdlib=libc++" LDFLAGS="-stdlib=libc++" PREFIX=/usr/local PKG_CONFIG=pkgconf PKG_CONFIG_PATH="/usr/local/lib/x86_64-linux-gnu/pkgconfig:/usr/local/lib/pkgconfig"`

### Progress against validation criteria (from session instructions)
1. Successful container image build - **IN PROGRESS** (full dep chain builds; Hyprland compile itself never completed yet)
2. Successful local container startup with dummy display - **PARTIAL**: first boot showed dbus/udev/seatd/pipewire/pipewire-pulse/sunshine RUNNING; hyprland failed to start (missing binary at that time, see problems); wireplumber failed on missing dbus session bus (fixed since, unvalidated)
3. Container startup with real NVIDIA GPU on Cloud VM - NOT STARTED (machine available at 172.232.33.143)
4. Moonlight connection to debug container - NOT STARTED

---

## 2. Problems encountered (chronological, with fixes)

1. **apt cache mount lock contention** - two stages using the same default cache mount ran in parallel -> `Could not get lock /var/cache/apt/archives/lock`. Fix: distinct cache mount ids (`cache-build`, `cache-main`).
2. **Non-executable overlay scripts** - `exec: "/cloudy/entrypoint-hyprland.sh": permission denied`. Fix: `RUN chmod +x /cloudy/*.sh /cloudy/bin/*.sh` in Dockerfile (host chmod alone does not affect built layers).
3. **Progressive-layer workflow adopted** (per user instruction): split package installs into separate RUN layers; on failure, build up to the failing layer, debug interactively via `docker run` + exec, then resume. This was essential - there were ~20 build iterations.
4. **toml++ ABI mismatch** - Ubuntu's libtomlplusplus compiled against libstdc++; our build uses libc++ -> undefined `std::__1` refs linking hyprcursor. Fix: build toml++ v3.4.0 (header-only) + hand-written header-only `.pc` in /usr/local (pkg-config precedence).
5. **Old system libs shadowing new ones at link time** - headers from /usr/local, but linker resolved Ubuntu `.so` (libinput 1.25 / libdisplay-info 0.1.1 missing new symbols). Fixes: `PKG_CONFIG_PATH` env, symlink `/usr/local/lib/x86_64-linux-gnu/*.so*` into `/usr/local/lib` (linker default path does not include the multiarch subdir under /usr/local), and finally removing Ubuntu's dev symlinks `/usr/lib/x86_64-linux-gnu/libinput.so` + `libdisplay-info.so` before aquamarine build. Also `/etc/ld.so.conf.d/999-cloudypad-local.conf` in main stage for runtime precedence.
6. **Hyprland requires C++26** -> clang-20 + libc++ from noble repos (no external repos needed).
7. **Missing/renamed git submodules** - Hyprland needs `--recursive` clone (subprojects/udis86); re2 bundled abseil assumption wrong (see 9).
8. **Stage-split footgun** - a debugging stage boundary (`FROM build-hyprland AS build-deps-ready` inserted mid-chain) made `build-hyprland` end early; main stage `COPY --from=build-hyprland` silently copied a half-built `/usr/local` (no aquamarine/Hyprland/xwayland-satellite binaries) -> container started with NO Hyprland binary while supervisor reported hyprland "RUNNING" (it was crash-looping through udev wait). Fix: main stage copies from `build-deps-ready` (the real final build stage). LESSON: after adding a stage boundary, update all `--from` references.
9. **pkgconf/pkg-config infinite loop at Hyprland cmake configure** - THE current blocker. Chain of discovery:
   - cmake configure of Hyprland hung at "Found lcms2" with 100% CPU single core, no output
   - cmake was in `wait4` on a nested cmake (`cmake -P` script from FindPkgConfig IMPORTED_TARGET resolution), which spawned `pkg-config --cflags-only-I hyprutils hyprwire re2 readline` -> legacy pkg-config 0.29.2 spun forever (dedup bug with duplicate Requires)
   - Switched to `pkgconf` (`ENV PKG_CONFIG=pkgconf` + pkgconf package): hang moved to `pkgconf --static --cflags-only-I xkbcommon uuid ... lcms2` (cmake passes `--static` because consuming target `hyprland_lib` is STATIC)
   - Bisection inside the hung process's mount namespace via `nsenter -t <pid> -m -p` (host /proc reaches container processes): every module alone OK; combined list hangs; the 7th module (`re2`) triggers it - re2.pc `Requires:` lists 15 `absl_*` modules and pkgconf 1.8.1 loops when combined with other modules
   - Fix (pushed, validation pending): abseil built SHARED + `re2.pc` flattened by hand (no Requires line; absl deps carried via re2.so DT_NEEDED)
10. **wireplumber exit 70** - no dbus session bus at wireplumber start time (bus was created inside `start-hyprland.sh`, which starts AFTER pipewire). Fix: dedicated `dbus-session` supervisor service (priority 15) + start scripts source `export-dbus-address.sh`. Unvalidated.
11. **wait-udev-availability.sh fails as non-root** - `udevadm control --ping` requires root (control socket root-only); hyprland program runs as `cloudy` -> 20 retries -> exit loop. Fix: removed the udev wait from `start-hyprland.sh` (compositor does not need udev before start; uinput devices come later). Unvalidated.
12. **Remote machine reboots** twice mid-build (unknown cause). /tmp logs lost. Check `uptime` when reconnecting.

---

## 3. What we may do later (suggested order)

1. **Resume the build on 172.232.33.143**: `ssh root@172.232.33.143`, check uptime (reboot watch), `cd /opt/cloudypad-core && git pull`, `docker build -t cloudypad/sunshine:hyprland -f containers/sunshine/Dockerfile.hyprland containers/sunshine`. If the re2.pc flattening did not clear the pkgconf hang, next options: (a) bisect further in the hung process namespace (nsenter technique above), (b) flatten the offending pc files entirely, (c) as nuclear option reconsider gcc-14/libstdc++ toolchain instead of libc++ (simplifies Ubuntu C++ deps but risks C++26 libstdc++ gaps - unexplored).
2. **Verify the built image contents**: `docker run --rm cloudypad/sunshine:hyprland bash -c 'which Hyprland hyprctl xwayland-satellite waybar fuzzel pipewire wireplumber seatd; Hyprland --version'` - remember past silent truncation (problem 8); check ALL binaries present before booting.
3. **Boot the container on the GPU VM** (compose reference: `test/resources/docker-compose.hyprland-local.yml` - but on the VM use real `/var/lib/cloudypad/sunshine/*` paths or `/opt/cloudypad-core/tmp/...` local dirs; add `docker-compose.nvidia.yml`-style GPU wiring or run privileged which exposes /dev/dri anyway; no `runtime: nvidia` needed for a first boot test). Then:
   - check all supervisor programs RUNNING (dbus, dbus-session, udev, seatd, pipewire, pipewire-pulse, wireplumber, hyprland, sunshine) via `/cloudy/log/*.log` + `pgrep`
   - `hyprctl outputs` should show the `cloudypad` headless output; `hyprctl monitors`
   - `wayland-info` connects (wait-wayland-availability.sh probe)
   - NVIDIA path: with RTX 4000 Ada (datacenter-class, render-only?) check whether Hyprland starts on `/dev/dri` via `AQ_NO_KMS_REQUIREMENT=1`; driver userspace still installed by `setup-nvidia-driver.sh` (.run) - Container Toolkit retest is a later task (see analysis footgun 3)
4. **Moonlight end-to-end**: Sunshine web UI on `https://<vm-ip>:47990` (creds in compose: user `sunshine`, password `sunshine`), pair with Moonlight, launch Desktop app, validate `setup-sunshine-screen-mode.sh` Wayland branch resizes the headless output to the client resolution.
5. **Then**: Steam/Proton smoke test (bwrap sandbox under privileged container), Heroic/Lutris, gamescope-nested Big Picture session (add as extra apps.json entry), Xvfb-glamor debug backend (Selkies pattern), unprivileged run (podstage-style seccomp/userns), then productionize: fold Dockerfile.hyprland into the main Dockerfile, update ansible compose templates (drop xfce4 mount, `XDG_RUNTIME_DIR` as tmpfs, keyboard env -> XKB), update `container-x-analysis.md` validation checklist.

### Key gotchas for the next agent
- The legacy `pkg-config` binary hangs on our dependency graph - always use `PKG_CONFIG=pkgconf` in build stages.
- `nsenter -t <container-process-pid> -m -p` from the host is the fastest way to debug a hung RUN step (buildkit containers are ephemeral, but /proc reaches them).
- `pip3 install` needs `-U` to override apt-installed versions; meson/cmake both come from pip.
- Noble meson (1.3.2) is too old for libxkbcommon 1.13 (needs 1.4+).
- Meson feature options: some projects want `true/false`, others `enabled/disabled/auto`, libei documentation is an array (leave it out).
- After touching the stage boundary, re-check every `COPY --from=`.
- Remote VM reboots wiped `/tmp/build-hyprland.log` twice - persist logs somewhere durable (eg. `/opt/cloudypad-core/tmp/build.log`) next time.
