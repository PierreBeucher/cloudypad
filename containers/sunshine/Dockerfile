# Ubuntu 24.04
FROM ubuntu:noble-20241118.1@sha256:80dd3c3b9c6cecb9f1667e9290b3bc61b78c2678c02cbdae5f0fea92cc6734ab

ENV DEBIAN_FRONTEND=noninteractive

# Main packages: X server and deps, dbus, pulseaudio, supervisor
# TODO add cleanup
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    apt update && apt install -y \
    xserver-xorg \
    curl \
    x11-utils \
    x11-xfs-utils \
    x11-xkb-utils \
    x11-xserver-utils \
    x11vnc \
    xauth \
    xbindkeys \
    xclip \
    xcvt \
    xdotool \
    xfishtank \
    xfonts-base \
    xinit \
    xorg \
    xserver-xorg-core \
    xserver-xorg-input-evdev \
    xserver-xorg-input-libinput \
    xserver-xorg-legacy \
    xserver-xorg-video-all \
    xserver-xorg-video-dummy \
    dbus \
    dbus-x11 \
    avahi-utils \
    libxcomposite-dev \
    libxcursor1 \
    wmctrl \
    supervisor \
    pulseaudio \
    gettext-base 

#
# Desktop
#
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    apt install -y xfce4

#
# Sunshine
#
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    curl -L -o /tmp/sunshine.deb https://github.com/LizardByte/Sunshine/releases/download/v2025.122.141614/sunshine-ubuntu-24.04-amd64.deb && \
    apt install -y /tmp/sunshine.deb && \
    rm /tmp/sunshine.deb

#
# Steam
#

# Add i386 (32 bit) architecture as Steam needs to run on both 32 and 64 bit packages
# Install packages required by Steam 
# (normally done by Steam with steamdeps on first run but allow faster startup) 
# TODO probably too much packages here, maybe we can cleanup a bit
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    dpkg --add-architecture i386 && apt update && \
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
    libnvidia-egl-gbm1 \
    python3-apt \
    xterm \
    xz-utils \
    zenity \
    bubblewrap

# Install specific version of Steam for better reproducibility
ENV CLOUDYPAD_STEAM_VERSION="1.0.0.81"

# Install Steam and Steam libs via official .deb
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    curl -o /tmp/steam-libs-amd64.deb "https://repo.steampowered.com/steam/archive/stable/steam-libs-amd64_${CLOUDYPAD_STEAM_VERSION}_amd64.deb" && \
    curl -o /tmp/steam-libs-i386.deb "https://repo.steampowered.com/steam/archive/stable/steam-libs-i386_${CLOUDYPAD_STEAM_VERSION}_i386.deb" && \
    apt install -y /tmp/steam-libs-amd64.deb && \
    apt install -y /tmp/steam-libs-i386.deb && \
    rm /tmp/steam-libs-amd64.deb && \
    rm /tmp/steam-libs-i386.deb

RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    curl -o steam.deb "https://repo.steampowered.com/steam/archive/stable/steam-launcher_${CLOUDYPAD_STEAM_VERSION}_all.deb" && \
    apt install -y ./steam.deb && \
    rm steam.deb

# # TODO Local (for debug)
# # Keep here ?
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    apt update && \
    apt install -y locales && \
    locale-gen fr_FR.UTF-8 && \
    locale-gen en_US.UTF-8 && \
    update-locale LANG=fr_FR.UTF-8

# Use this display by default, should not conflict with other displays
ENV DISPLAY=":42"

# User under which non-root services and softwares will run
ENV CLOUDYPAD_USER=cloudy

# Data directory that should be persisted via volume or bind mount
ENV CLOUDYPAD_DATA_DIR=/cloudy/data
ENV CLOUDYPAD_LOG_DIR=/cloudy/log
ENV CLOUDYPAD_CONF_DIR=/cloudy/conf

# Default name for Sunshine server (as shown by Moonlight)
# Used in sunshine.conf templates
ENV SUNSHINE_SERVER_NAME="Sunshine"

#
# XDG directories used by some services
# Some program expect these paths to exist (or would use some default location)
# Setting proper XDG_* variables allow more control other config and data persistence
# See https://specifications.freedesktop.org/basedir-spec/latest/
# 
ENV XDG_RUNTIME_DIR=/cloudy/runtime
ENV XDG_CACHE_HOME=/home/$CLOUDYPAD_USER/.cache

# TODO persist this folder ?
ENV XDG_CONFIG_HOME=/home/$CLOUDYPAD_USER/.config

# Write data in known directory for persistence
# XDG_DATA_HOME is used by various programs (like Steam) to store data
# Use this known directory to easily persist it as bind mount or volume
ENV XDG_DATA_HOME=$CLOUDYPAD_DATA_DIR

ENV DBUS_SYSTEM_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/dbus"

# Default keyboard layout used by x11 keyboard.conf 
# See overlay/cloudy/conf/x11/templates/00-keyboard.conf
ENV KEYBOARD_LAYOUT="fr"

# Run as non-root user
# TODO use host UID/GID for better portability and usage from host ?
RUN useradd -m -d /home/cloudy -s /bin/bash -u 1001 $CLOUDYPAD_USER

COPY overlay /

# Contain various Cloudy Pad scripts, add to PATH for easier use
ENV PATH=$PATH:/cloudy/bin

RUN chown -R cloudy:cloudy /cloudy

ENTRYPOINT [ "/cloudy/entrypoint.sh" ]