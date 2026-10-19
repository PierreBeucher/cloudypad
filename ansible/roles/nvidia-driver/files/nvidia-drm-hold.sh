#!/bin/sh
# Hold the NVIDIA DRM RENDER node open forever (exec replaces the shell with
# cat, keeping the device FD open until killed).
#
# Used by nvidia-drm-hold.service: on headless NVIDIA GPUs (datacenter), the
# nvidia_drm module unloads itself when the last client closes the DRM
# devices, making /dev/dri/cardN and renderD* disappear.
#
# NEVER hold the card node (/dev/dri/cardN): an open card client takes
# NVKMS modesetting ownership, and the X server then fails to start with
# "Failed to acquire modesetting permission". Holding the RENDER node keeps
# the module loaded without claiming modesetting ownership, leaving the
# card node free for the X server.
#
# Self-healing: if the nvidia module stack is loaded but nvidia_drm already
# tore itself down (eg. it raced this service at boot), reload it so the
# render node reappears and can be held.

set -e

if [ -c /dev/nvidia0 ] && ! grep -q "^nvidia_drm " /proc/modules; then
    echo "nvidia-drm-hold: nvidia_drm not loaded, reloading with modeset=1"
    modprobe nvidia_drm modeset=1 || true
    sleep 2
fi

for render in /dev/dri/renderD*; do
    [ -c "$render" ] || continue
    node="${render##*/}"
    # NVIDIA DRM nodes expose their driver via sysfs
    if [ -L "/sys/class/drm/$node/device/driver" ]; then
        driver=$(basename "$(readlink -f "/sys/class/drm/$node/device/driver")")
        if [ "$driver" = "nvidia" ]; then
            echo "nvidia-drm-hold: holding $render open"
            exec cat "$render"
        fi
    fi
done

echo "nvidia-drm-hold: no NVIDIA DRM render node found (yet)"
exit 1
