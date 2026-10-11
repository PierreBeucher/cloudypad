#
# Global versions for the labwc desktop stack build stage
#
ARG WLROOTS_VERSION="0.19.3"
ARG LABWC_VERSION="0.9.7"
ARG WAYLAND_VERSION="1.23.1"
ARG PIXMAN_VERSION="0.43.4"
ARG LIBSFDO_VERSION="0.1.4"

# Download installers in base to bind-mount them in other stages
FROM alpine/curl:8.14.1 AS download-base
WORKDIR /app

# Sunshine
# https://github.com/LizardByte/Sunshine/releases
FROM download-base AS download-sunshine
ARG SUNSHINE_VERSION=2025.924.154138
RUN curl -fL -o /app/sunshine.deb "https://github.com/LizardByte/Sunshine/releases/download/v${SUNSHINE_VERSION}/sunshine-ubuntu-24.04-amd64.deb"

# Steam
# https://repo.steampowered.com/steam/archive/stable/
FROM download-base AS download-steam
ARG STEAM_VERSION="1.0.0.81"
RUN curl -f -o /app/steam-libs-amd64.deb "https://repo.steampowered.com/steam/archive/stable/steam-libs-amd64_${STEAM_VERSION}_amd64.deb"
RUN curl -f -o /app/steam-libs-i386.deb "https://repo.steampowered.com/steam/archive/stable/steam-libs-i386_${STEAM_VERSION}_i386.deb"
RUN curl -f -o /app/steam.deb "https://repo.steampowered.com/steam/archive/stable/steam-launcher_${STEAM_VERSION}_all.deb"

# Lutris
# https://github.com/lutris/lutris/releases
FROM download-base AS download-lutris
ARG LUTRIS_VERSION="0.5.20"
RUN curl -fL -o /app/lutris.deb "https://github.com/lutris/lutris/releases/download/v${LUTRIS_VERSION}/lutris_${LUTRIS_VERSION}_all.deb"

# Heroic
# https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases
FROM download-base AS download-heroic
ARG HEROIC_VERSION="2.19.1"

RUN curl -fL -o /app/heroic.deb "https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases/download/v${HEROIC_VERSION}/Heroic-${HEROIC_VERSION}-linux-amd64.deb"

#
# Build labwc Wayland desktop stack from source
# Ubuntu noble doesn't package labwc, and its wlroots/wayland/pixman are too
# old for the labwc 0.9.x series (wlroots >= 0.19, wayland >= 1.23.1,
# pixman >= 0.43.0). Built to /usr/local and copied to the runtime stage.
#
# Versions pinned on the Selkies base image build (proven in streaming containers):
# https://github.com/selkies-project/selkies/blob/main/addons/base/build-labwc.sh
#
# Build order: wayland -> pixman -> libsfdo -> libdisplay-info -> wlroots -> labwc
#
# wlroots is built with all default backends (labwc sources include DRM
# headers unconditionally), but at runtime only the headless backend (virtual
# display output) and libinput (input devices, incl. virtual devices created
# by Sunshine via /dev/uinput) are used via the WLR_BACKENDS pin. DRM backend
# is unused: KMS master is unavailable in a container, X11 apps run via
# XWayland.
#

FROM ubuntu:noble AS build-labwc-deps

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_LABWC_DEPS

set -e

apt update

apt install -y \
    build-essential \
    gettext \
    git \
    meson \
    ninja-build \
    pkgconf \
    curl \
    ca-certificates \
    libdrm-dev \
    libgbm-dev \
    libegl1-mesa-dev \
    libgles2-mesa-dev \
    libglvnd-dev \
    libinput-dev \
    libseat-dev \
    libudev-dev \
    libvulkan-dev \
    liblcms2-dev \
    libpixman-1-dev \
    libwayland-dev \
    wayland-protocols \
    libxcb1-dev \
    libxcb-composite0-dev \
    libxcb-dri3-dev \
    libxcb-ewmh-dev \
    libxcb-icccm4-dev \
    libxcb-present-dev \
    libxcb-randr0-dev \
    libxcb-render0-dev \
    libxcb-render-util0-dev \
    libxcb-res0-dev \
    libxcb-shape0-dev \
    libxcb-shm0-dev \
    libxcb-sync-dev \
    libxcb-xfixes0-dev \
    libxcb-xinput-dev \
    libxml2-dev \
    libglib2.0-dev \
    libcairo2-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libpng-dev \
    libxkbcommon-dev \
    libexpat1-dev \
    libffi-dev \
    xwayland \
    hwdata

apt clean

_BUILD_LABWC_DEPS

FROM build-labwc-deps AS build-labwc-libs

ARG WLROOTS_VERSION
ARG LABWC_VERSION
ARG WAYLAND_VERSION
ARG PIXMAN_VERSION
ARG LIBSFDO_VERSION

# Our /usr/local builds must shadow Ubuntu system packages of the same
# libraries (wayland 1.23.1 vs noble 1.22.0, etc.)
ENV PKG_CONFIG_PATH="/usr/local/lib/x86_64-linux-gnu/pkgconfig:/usr/local/lib/pkgconfig:/usr/local/share/pkgconfig"

# wayland: noble has 1.22.0, wlroots 0.19 requires >= 1.23.1
RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_WAYLAND

set -e

git clone --depth 1 --branch "${WAYLAND_VERSION}" https://gitlab.freedesktop.org/wayland/wayland.git /build/wayland
cd /build/wayland
meson setup build --buildtype=release --prefix /usr/local --libdir=lib \
    -Ddocumentation=false \
    -Ddtd_validation=false \
    -Dtests=false
ninja -C build install
ldconfig

_BUILD_WAYLAND

# pixman: noble has 0.42.2, wlroots 0.19 requires >= 0.43.0
RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_PIXMAN

set -e

git clone --depth 1 --branch "pixman-${PIXMAN_VERSION}" https://gitlab.freedesktop.org/pixman/pixman.git /build/pixman
cd /build/pixman
meson setup build --buildtype=release --prefix /usr/local --libdir=lib \
    -Dtests=disabled \
    -Ddemos=disabled \
    -Dgtk=disabled
ninja -C build install

_BUILD_PIXMAN

# libsfdo: desktop entry and icon lookup used by labwc (not packaged in noble)
RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_LIBSFDO

set -e

git clone --depth 1 --branch "v${LIBSFDO_VERSION}" https://gitlab.freedesktop.org/vyivel/libsfdo.git /build/libsfdo
cd /build/libsfdo
meson setup build --buildtype=release --prefix /usr/local --libdir=lib \
    -Dexamples=false \
    -Dtests=false
ninja -C build install
ldconfig

_BUILD_LIBSFDO

# libdisplay-info: EDID/display info parsing required by wlroots DRM backend
# (noble has 0.1.1, wlroots 0.19 requires >= 0.2.0 APIs)
# Built even though DRM backend is unused at runtime: labwc sources include
# wlr/backend/drm.h unconditionally, and the header is only installed when
# the DRM backend is built
RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_LIBDISPLAY_INFO

set -e

git clone --depth 1 --branch "0.2.0" https://gitlab.freedesktop.org/emersion/libdisplay-info.git /build/libdisplay-info
cd /build/libdisplay-info
meson setup build --buildtype=release --prefix /usr/local --libdir=lib
ninja -C build install
ldconfig

_BUILD_LIBDISPLAY_INFO

# wlroots: labwc 0.9.x requires wlroots >= 0.19 (noble only has 0.17)
# Built with all default backends (incl. DRM, see libdisplay-info note above):
# only headless and libinput are used at runtime (WLR_BACKENDS pin)
# Patched: headless backend must NOT claim hardware cursor support (its
# set_cursor stub silently discards the cursor buffer), otherwise the cursor
# stays on the "hardware" path and is never composited into the output
# buffer - invisible to Sunshine and any wlr-screencopy client
COPY patches/wlroots-headless-software-cursor.patch /build/patches/
RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_WLROOTS

set -e

git clone --depth 1 --branch "${WLROOTS_VERSION}" https://gitlab.freedesktop.org/wlroots/wlroots.git /build/wlroots
cd /build/wlroots
git apply /build/patches/wlroots-headless-software-cursor.patch
meson setup build --buildtype=release --prefix /usr/local --libdir=lib \
    -Dexamples=false
ninja -C build install
ldconfig

_BUILD_WLROOTS

# labwc: stacking/floating Wayland compositor, main Cloudy Pad desktop session
RUN --mount=type=cache,id=cache-build,target=/var/cache --mount=type=tmpfs,target=/var/log <<_BUILD_LABWC

set -e

git clone --depth 1 --branch "${LABWC_VERSION}" https://github.com/labwc/labwc.git /build/labwc
cd /build/labwc
meson setup build --buildtype=release --prefix /usr/local --libdir=lib \
    -Dxwayland=enabled \
    -Dnls=enabled
ninja -C build install
ldconfig

_BUILD_LABWC

# Debug stage boundary: build --target build-labwc-libs then docker run to inspect
FROM build-labwc-libs AS build-labwc

#
# Sunshine image based on Ubuntu 24.04
# with Wayland desktop environment (labwc + waybar + fuzzel), game launchers and dependencies
#
FROM ubuntu:noble-20260210.1@sha256:98ff7968124952e719a8a69bb3cccdd217f5fe758108ac4f21ad22e1df44d237

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log <<_MAIN_PACKAGES

set -e

# Required for some Steam packages
dpkg --add-architecture i386

apt update

# Main system packages: Wayland desktop stack (labwc, waybar, fuzzel), PipeWire audio,
# X11 tools for XWayland apps, dbus, supervisor...
# xcb/xml/rsvg runtime libs are required by labwc/wlroots (build-stage dev
# packages are not present in the runtime stage)
apt install -y \
    curl \
    x11-utils \
    x11-xkb-utils \
    x11-xserver-utils \
    xauth \
    xclip \
    xdotool \
    xfonts-base \
    xwayland \
    dbus \
    dbus-x11 \
    avahi-utils \
    libxcursor1 \
    wmctrl \
    supervisor \
    seatd \
    libseat1 \
    libinput10 \
    liblcms2-2 \
    libxml2 \
    libglib2.0-0t64 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    librsvg2-2 \
    libpng16-16t64 \
    libxcb1 \
    libxcb-ewmh2 \
    libxcb-icccm4 \
    libxcb-composite0 \
    libxcb-res0 \
    libxcb-shape0 \
    libxcb-xfixes0 \
    libxcb-render0 \
    libxcb-render-util0 \
    libxcb-shm0 \
    libxcb-sync1 \
    libxcb-present0 \
    libxcb-randr0 \
    libxcb-xinput0 \
    libxcb-util1 \
    pipewire \
    pipewire-pulse \
    wireplumber \
    waybar \
    fuzzel \
    wlr-randr \
    wayland-utils \
    xdg-desktop-portal \
    xdg-desktop-portal-gtk \
    adwaita-icon-theme \
    fonts-noto-core \
    fonts-noto-color-emoji \
    swaybg \
    librsvg2-bin \
    gettext-base \
    bc \
    kmod \
    python3-apt \
    xterm \
    xz-utils \
    zenity \
    bubblewrap \
    software-properties-common \
    nano \
    unzip \
    gedit
apt install -y \
    libxcb1:i386 \
    libxcb1:amd64 \
    libc6:amd64 \
    libc6:i386 \
    libegl1:amd64 \
    libegl1:i386 \
    libgbm1:amd64 \
    libgbm1:i386 \
    libgl1-mesa-dri:amd64 \
    libgl1-mesa-dri:i386 \
    libgl1:amd64 \
    libgl1:i386 \
    steam-libs-i386:i386 \
    steam-libs-amd64:amd64 \
    libvulkan1:amd64 \
    libvulkan1:i386 \
    libxext6:amd64 \
    libxext6:i386 \
    libxtst6:amd64 \
    libxtst6:i386 \
    libxrandr2:amd64 \
    libxrandr2:i386 \
    libpulse0:amd64 \
    libpulse0:i386 \
    libglx0:amd64 \
    libglx0:i386 \
    libglx-mesa0:amd64 \
    libglx-mesa0:i386 \
    mesa-utils \
    mesa-vulkan-drivers:amd64 \
    mesa-vulkan-drivers:i386 \
    libgbm1:amd64 \
    libgbm1:i386 \
    libgles2:amd64 \
    libgles2:i386 \
    libegl1:amd64 \
    libegl1:i386 \
    libgl1-mesa-dri:amd64 \
    libgl1-mesa-dri:i386 \
    libnvidia-egl-gbm1

apt clean

_MAIN_PACKAGES

#
# Locales, sudo and Firefox
#
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log <<_LOCALE_FIREFOX

set -e

apt update

apt install -y \
    sudo \
    locales

apt clean

# Install Firefox as apt package (not snap)
# Need to explicitely avoid snap by using Firefox PPA and prioritising non-snap version
# See https://askubuntu.com/a/1404401
add-apt-repository ppa:mozillateam/ppa

echo "\
Package: * \n\
Pin: release o=LP-PPA-mozillateam \n\
Pin-Priority: 1001 \n\
\n\
Package: firefox \n\
Pin: version 1:1snap* \n\
Pin-Priority: -1" | tee /etc/apt/preferences.d/mozilla-firefox

apt update
apt install -y firefox

apt clean

_LOCALE_FIREFOX

# Default locale
RUN locale-gen en_US.UTF-8 && \
    update-locale LANG=en_US.UTF-8

#
# labwc desktop stack (compositor, wlroots, wayland, pixman, libsfdo)
# built in previous stage, copied wholesale to shadow Ubuntu's older
# system libraries (same SONAME, newer symbols)
#
COPY --from=build-labwc /usr/local/ /usr/local/

# Ensure /usr/local libs (wayland 1.23, pixman 0.43, wlroots...) take precedence
# over Ubuntu system versions - /usr/local/lib/x86_64-linux-gnu is NOT in
# default ld.so.conf.d on Ubuntu
RUN echo "/usr/local/lib/x86_64-linux-gnu" > /etc/ld.so.conf.d/999-cloudypad-local.conf && \
    echo "/usr/local/lib" >> /etc/ld.so.conf.d/999-cloudypad-local.conf && \
    ldconfig

#
# Sunshine
#
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log --mount=type=bind,from=download-sunshine,source=/app,target=/app <<_SUNSHINE

set -e
apt update
apt install -y /app/sunshine.deb

_SUNSHINE

#
# Steam
#

# Install Steam and Steam libs via official .deb
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log --mount=type=bind,from=download-steam,source=/app,target=/app <<_STEAM

set -e

apt install -y /app/steam-libs-amd64.deb
apt install -y /app/steam-libs-i386.deb
apt install -y /app/steam.deb

# Patch steam launch script to prevent Desktop shortcut creation on first launch:
# The file is redundant with launchbar shortcut but is on trusted by default on desktop and does not use Cloudy Pad launcher script
sed -i 's/if \[ ! -L "\$DESKTOP_DIR\/\$STEAMPACKAGE\.desktop" \]; then/if false; then # Patched by Cloudy Pad: prevent deskop shortcut creation/' /usr/lib/steam/bin_steam.sh

_STEAM

#
# Lutris
#
RUN --mount=type=bind,from=download-lutris,source=/app/lutris.deb,target=/app/lutris.deb <<_LUTRIS

set -e

apt install -y /app/lutris.deb

_LUTRIS

#
# Heroic
#
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log --mount=type=bind,from=download-heroic,source=/app/heroic.deb,target=/app/heroic.deb <<_HEROIC

set -e

apt install -y /app/heroic.deb

_HEROIC

# GE-Proton version that will be installed and configured for Heroic by default
ENV CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION="GE-Proton10-32"

# 
# Global environment variables
#

# XWayland display provided by labwc: X11 apps (Steam, Heroic, Lutris...)
# connect here. wlroots scans for a free display starting at :0, reliable
# in-container since no other X server runs.
ENV DISPLAY=":0"

# Wayland display provided by labwc: native Wayland apps and Sunshine
# (capture = wlr) connect here
ENV WAYLAND_DISPLAY="wayland-0"

# Wayland desktop session environment
ENV XDG_SESSION_TYPE=wayland
ENV XDG_CURRENT_DESKTOP=labwc
ENV XDG_SESSION_DESKTOP=labwc

# Cursor theme: Steam/CEF read GTK settings and fall back to raw X glyphs
ENV XCURSOR_THEME=Adwaita

# User under which non-root services and softwares will run
ENV CLOUDYPAD_USER=cloudy
ENV CLOUDYPAD_USER_HOME=/home/$CLOUDYPAD_USER

# Data directory that should be persisted via volume or bind mount
ENV CLOUDYPAD_DATA_DIR=/cloudy/data
ENV CLOUDYPAD_LOG_DIR=/cloudy/log
ENV CLOUDYPAD_CONF_DIR=/cloudy/conf
# TODO as tmpfs ? 
ENV CLOUDYPAD_RUNTIME_DIR=/cloudy/runtime 
ENV CLOUDYPAD_BIN_DIR=/cloudy/bin

# Default name for Sunshine server (as shown by Moonlight)
# Used in sunshine.conf templates
ENV SUNSHINE_SERVER_NAME="Sunshine"

#
# XDG directories used by some services
# Some program expect these paths to exist (or would use some default location)
# Setting proper XDG_* variables allow more control other config and data persistence
# See https://specifications.freedesktop.org/basedir-spec/latest/
# 
ENV XDG_RUNTIME_DIR=$CLOUDYPAD_RUNTIME_DIR
ENV XDG_CONFIG_HOME=$CLOUDYPAD_CONF_DIR
ENV XDG_CACHE_HOME=$CLOUDYPAD_USER_HOME/.cache

# Write data in known directory for persistence
# XDG_DATA_HOME is used by various programs (like Steam) to store data
# Use this known directory to easily persist it as bind mount or volume
ENV XDG_DATA_HOME=$CLOUDYPAD_DATA_DIR

ENV DBUS_SYSTEM_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/dbus"

# Run as non-root user
# TODO use host UID/GID for better portability and usage from host ?
RUN useradd -m -d $CLOUDYPAD_USER_HOME -s /bin/bash -u 1001 $CLOUDYPAD_USER

# Copy overlay files: startup scripts, default config, etc.
COPY overlay /
RUN chmod +x /cloudy/*.sh /cloudy/bin/*.sh

# Rasterize wallpaper to PNG: Wayland wallpaper tools (swaybg) do not render SVG
RUN mkdir -p /usr/share/cloudypad && \
    rsvg-convert -w 1920 -h 1080 -o /usr/share/cloudypad/wallpaper.png $CLOUDYPAD_CONF_DIR/cloudypad/wallpaper.svg

# Run healthcheck using script
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD /cloudy/bin/sunshine-healthcheck.sh

# Allow user "cloudy" to stop container
RUN echo "cloudy ALL=(ALL) NOPASSWD: ${CLOUDYPAD_BIN_DIR}/stop-supervisord.sh" > /etc/sudoers.d/cloudy-stop-container

# Contain various Cloudy Pad scripts, add to PATH for easier use
ENV PATH=$PATH:/cloudy/bin

RUN chown -R cloudy:cloudy /cloudy

ENTRYPOINT [ "/cloudy/entrypoint.sh" ]