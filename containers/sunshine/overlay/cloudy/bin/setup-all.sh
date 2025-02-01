#!/usr/bin/env bash

set -e

#
# Setup services and components configs on container startup depending on runtime context:
# - Copy Xorg configuration adapted for GPU and driver used
# - Setup additional driver component (eg. NVIDIA driver component for X)
# 

setup-dirs.sh

if [ "$NVIDIA_ENABLE" = true ]; then
    setup-nvidia-driver.sh
fi

setup-x-config.sh
