#!/usr/bin/env bash

set -e

#
# Setup services and components configs on container startup depending on runtime context:
# - Setup locale
# - Setup directories and permissions
# - Setup user groups for device access
# - Setup additional driver component (eg. NVIDIA driver userspace libraries)
# - Setup labwc desktop config
#

source setup-locale.sh

source setup-dirs.sh

source setup-user.sh

if [ "$NVIDIA_ENABLE" = true ]; then
    source setup-nvidia-permissions.sh
    source setup-nvidia-driver.sh
fi

setup-labwc-config.sh

setup-heroic.sh