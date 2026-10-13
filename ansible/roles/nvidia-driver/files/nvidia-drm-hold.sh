#!/bin/sh
# Find the NVIDIA DRM card and hold it open forever (exec replaces the shell
# with cat, keeping the device FD open until killed).
#
# Used by nvidia-drm-hold.service: on headless NVIDIA GPUs (datacenter), the
# nvidia_drm module unloads itself when the last client closes the card
# device, making the DRM card disappear. Holding it open prevents the
# last-close teardown (see service unit for details).

set -e

for card in /dev/dri/card*; do
    [ -c "$card" ] || continue
    node="${card##*/}"
    # nvidia cards expose their driver via sysfs
    if [ -L "/sys/class/drm/$node/device/driver" ]; then
        driver=$(basename "$(readlink -f "/sys/class/drm/$node/device/driver")")
        if [ "$driver" = "nvidia" ]; then
            echo "nvidia-drm-hold: holding $card open"
            exec cat "$card"
        fi
    fi
done

echo "nvidia-drm-hold: no NVIDIA DRM card found (yet)"
exit 1