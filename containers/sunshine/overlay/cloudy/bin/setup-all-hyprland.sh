#!/usr/bin/env bash

set -e

#
# Setup services and components configs on container startup depending on runtime context:
# - Setup locale and keyboard layout (applied to Hyprland config)
# - Setup Hyprland config
# - Setup additional driver component (eg. NVIDIA driver userspace libraries)
#

source setup-locale.sh

source setup-dirs.sh

source setup-user.sh

if [ "$NVIDIA_ENABLE" = true ]; then
    source setup-nvidia-permissions.sh
    source setup-nvidia-driver.sh
fi

setup-hyprland-config.sh

setup-heroic.sh
