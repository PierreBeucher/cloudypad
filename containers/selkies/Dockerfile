# Download installers in base to bind-mount them in other stages
FROM alpine/curl:8.14.1 AS download-base
WORKDIR /app

# Sunshine
FROM download-base AS download-sunshine
ARG SUNSHINE_VERSION=2025.628.4510

RUN curl -L -o /app/sunshine.deb "https://github.com/LizardByte/Sunshine/releases/download/v${SUNSHINE_VERSION}/sunshine-ubuntu-24.04-amd64.deb"

# Steam
FROM download-base AS download-steam
ARG STEAM_VERSION="1.0.0.81"
RUN curl -o /app/steam-libs-amd64.deb "https://repo.steampowered.com/steam/archive/stable/steam-libs-amd64_${STEAM_VERSION}_amd64.deb"
RUN curl -o /app/steam-libs-i386.deb "https://repo.steampowered.com/steam/archive/stable/steam-libs-i386_${STEAM_VERSION}_i386.deb"
RUN curl -o /app/steam.deb "https://repo.steampowered.com/steam/archive/stable/steam-launcher_${STEAM_VERSION}_all.deb"

# Lutris
FROM download-base AS download-lutris
ARG LUTRIS_VERSION="0.5.18"
RUN curl -L -o /app/lutris.deb "https://github.com/lutris/lutris/releases/download/v${LUTRIS_VERSION}/lutris_${LUTRIS_VERSION}_all.deb"

# Heroic
FROM download-base AS download-heroic
ARG HEROIC_VERSION="2.18.0"
RUN curl -L -o /app/heroic.deb "https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases/download/v${HEROIC_VERSION}/Heroic-${HEROIC_VERSION}-linux-amd64.deb"

# 
# Sunshine image based on Ubuntu 24.04
# with desktop environment, game launchers and dependencies
#
FROM ghcr.io/selkies-project/nvidia-glx-desktop:latest

# Use root user to install packages
# Selkies base image set user to ubuntu
USER root

#
# Steam
#

# Install Steam and Steam libs via official .deb
RUN --mount=type=bind,from=download-steam,source=/app,target=/app <<_STEAM

set -e

apt update 

apt install -y /app/steam-libs-amd64.deb
apt install -y /app/steam-libs-i386.deb
apt install -y /app/steam.deb

# Patch steam launch script to prevent Desktop shortcut creation on first launch:
# The file is redundant with launchbar shortcut but is on trusted by default on desktop and does not use Cloudy Pad launcher script
sed -i 's/if \[ ! -L "\$DESKTOP_DIR\/\$STEAMPACKAGE\.desktop" \]; then/if false; then # Patched by Cloudy Pad: prevent deskop shortcut creation/' /usr/lib/steam/bin_steam.sh

_STEAM

USER ubuntu


# 
# Global environment variables
#

# # Use this display by default, should not conflict with other displays
# ENV DISPLAY=":42"

# # User under which non-root services and softwares will run
# ENV CLOUDYPAD_USER=cloudy
# ENV CLOUDYPAD_USER_HOME=/home/$CLOUDYPAD_USER

# Data directory that should be persisted via volume or bind mount
ENV CLOUDYPAD_DATA_DIR=/cloudy/data
ENV CLOUDYPAD_LOG_DIR=/cloudy/log
ENV CLOUDYPAD_CONF_DIR=/cloudy/conf

# TODO as tmpfs ? 
ENV CLOUDYPAD_RUNTIME_DIR=/cloudy/runtime 

# # Default name for Sunshine server (as shown by Moonlight)
# # Used in sunshine.conf templates
# ENV SUNSHINE_SERVER_NAME="Sunshine"

# #
# # XDG directories used by some services
# # Some program expect these paths to exist (or would use some default location)
# # Setting proper XDG_* variables allow more control other config and data persistence
# # See https://specifications.freedesktop.org/basedir-spec/latest/
# # 
# ENV XDG_CONFIG_HOME=$CLOUDYPAD_CONF_DIR
# ENV XDG_CACHE_HOME=$CLOUDYPAD_USER_HOME/.cache

# # Write data in known directory for persistence
# # XDG_DATA_HOME is used by various programs (like Steam) to store data
# # Use this known directory to easily persist it as bind mount or volume
# ENV XDG_DATA_HOME=$CLOUDYPAD_DATA_DIR

# ENV DBUS_SYSTEM_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/dbus"

# # Run as non-root user
# # TODO use host UID/GID for better portability and usage from host ?
# RUN useradd -m -d $CLOUDYPAD_USER_HOME -s /bin/bash -u 1001 $CLOUDYPAD_USER

# # Copy overlay files: startup scripts, default config, etc. 
# COPY overlay /

# # Run healthcheck using script
# HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=3 \
#     CMD /cloudy/bin/sunshine-healthcheck.sh

# # Allow user "cloudy" to stop container
# RUN echo "cloudy ALL=(ALL) NOPASSWD: ${CLOUDYPAD_BIN_DIR}/stop-supervisord.sh" > /etc/sudoers.d/cloudy-stop-container

# # Contain various Cloudy Pad scripts, add to PATH for easier use
# ENV PATH=$PATH:/cloudy/bin

# RUN chown -R cloudy:cloudy /cloudy