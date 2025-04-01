#!/usr/bin/env bash

set -e

#
# Setup services and components configs on container startup depending on runtime context:
# - Setup locale and keyboard layout
# - Copy Xorg configuration adapted for GPU and driver used
# - Setup additional driver component (eg. NVIDIA driver component for X)
# 

source setup-locale.sh

source setup-dirs.sh

source setup-user.sh

if [ "$NVIDIA_ENABLE" = true ]; then
    source setup-nvidia-driver.sh
fi

source setup-x-config.sh

setup-pulseaudio.sh