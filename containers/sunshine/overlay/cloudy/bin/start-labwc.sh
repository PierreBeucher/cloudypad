#!/usr/bin/env bash

set -e

#
# Start labwc Wayland compositor (wlroots) as the main desktop session
#
# - Headless backend provides the virtual display output (no real monitor
#   attached to the container). Output resolution is set at session start
#   (see below) and adjusted on Sunshine session start by
#   setup-sunshine-screen-mode.sh
# - libinput backend handles input devices, including virtual devices
#   created by Sunshine via /dev/uinput when a client connects
# - libseat session via seatd (no logind in container), user is granted
#   access to the seatd socket via "video" group (see setup-user.sh)
#
# X11 applications (Steam, Heroic, Lutris...) run via labwc-managed XWayland
#
# Desktop panel (waybar) and wallpaper (swaybg) are separate supervised
# services (see supervisord.conf), not children of the compositor
#

# Explicitly force seatd as libseat backend (no logind in container)
export LIBSEAT_BACKEND=seatd

# Pin wlroots backends: DRM (display output on GPU or vkms card) + libinput
# (input devices). Headless backend is added by labwc itself for virtual
# outputs when needed.
# Without the DRM pin, an available seat could make wlroots try other
# backends unexpectedly.
export WLR_BACKENDS=drm,libinput

# Sunshine virtual input devices only appear after a client connects:
# starting with zero input devices is fine
export WLR_LIBINPUT_NO_DEVICES=1

# Create the virtual display output at backend start when running headless
# (no DRM card with connectors, eg. NVIDIA datacenter GPUs). Skipped when
# WLR_DRM_DEVICES is set: the DRM card connector is the output.
# labwc's auto-created virtual output may otherwise end up disabled (eg.
# after a failed modeset during startup), leaving the compositor without
# outputs
if [ -z "$WLR_DRM_DEVICES" ]; then
    export WLR_HEADLESS_OUTPUTS=1
fi

# Session environment for spawned applications
export XDG_SESSION_TYPE=wayland
export XDG_CURRENT_DESKTOP=labwc
export XDG_SESSION_DESKTOP=labwc

# NOTE: no wait-udev-availability.sh here: udevadm control --ping requires root
# (control socket is root-only) and labwc does not need udev before starting.
# Input devices created by Sunshine (uinput) are handled by udevd at runtime.

# Wait for seatd socket (libseat session used by compositor for input)
SEATD_SOCKET=/run/seatd.sock
echo "Waiting for seatd socket at $SEATD_SOCKET..."
for i in $(seq 1 30); do
    if [ -S "$SEATD_SOCKET" ]; then
        echo "seatd socket found"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "WARNING: seatd socket not found after 30 attempts, starting labwc anyway (input may not work)"
    fi
    sleep 1
done

# Keyboard layout from Cloudy Pad environment: wlroots compositors read
# XKB_DEFAULT_* environment variables (replaces former Xorg 00-keyboard.conf)
export XKB_DEFAULT_LAYOUT=${CLOUDYPAD_KEYBOARD_LAYOUT:-us}
if [ -n "$CLOUDYPAD_KEYBOARD_MODEL" ]; then
    export XKB_DEFAULT_MODEL=$CLOUDYPAD_KEYBOARD_MODEL
fi
if [ -n "$CLOUDYPAD_KEYBOARD_VARIANT" ]; then
    export XKB_DEFAULT_VARIANT=$CLOUDYPAD_KEYBOARD_VARIANT
fi
if [ -n "$CLOUDYPAD_KEYBOARD_OPTIONS" ]; then
    export XKB_DEFAULT_OPTIONS=$CLOUDYPAD_KEYBOARD_OPTIONS
fi
echo "Keyboard layout: XKB_DEFAULT_LAYOUT=$XKB_DEFAULT_LAYOUT XKB_DEFAULT_MODEL=$XKB_DEFAULT_MODEL XKB_DEFAULT_VARIANT=$XKB_DEFAULT_VARIANT XKB_DEFAULT_OPTIONS=$XKB_DEFAULT_OPTIONS"

#
# Software rendering fallback for GPU-less environments (dev VMs, containers
# without GPU access)
#
# Mesa cannot drive some virtual GPUs (eg. VirtualBox VMSVGA/vmwgfx: driver
# removed from modern Mesa), making wlroots fall back to the pixman renderer
# which does not support the linux-dmabuf protocol Sunshine needs to capture.
#
# If a vkms (virtual KMS) card is available and no hardware GPU is present,
# use it as the DRM backend device: Mesa falls back to llvmpipe software
# rendering over GBM (vkms supports GBM buffer allocation), keeping DMA-BUF
# buffers usable for Sunshine capture.
#
# Note: vgem (virtual GEM) is NOT suitable: it is render-only and cannot
# allocate GBM buffers (gbm_bo_create fails).
#
# Real GPUs (NVIDIA, AMD, Intel) take precedence: no override is applied.
#

HARDWARE_GPU_FOUND=false
VKMS_CARD=""

for card_sys in /sys/class/drm/card[0-9]*; do
    node_name=$(basename $card_sys)
    # Skip connectors (card0-Virtual-1 style entries)
    [[ "$node_name" =~ ^card[0-9]+$ ]] || continue
    # Driver name via device/driver symlink; some virtual GPUs (vkms, vgem)
    # do not expose it: fall back to device modalias (eg. "platform:vkms")
    driver=$(basename $(readlink -f $card_sys/device/driver) 2>/dev/null || true)
    if [ -z "$driver" ] || [ "$driver" = "driver" ]; then
        modalias=$(cat $card_sys/device/modalias 2>/dev/null || echo "")
        case "$modalias" in
            platform:vgem) driver="vgem" ;;
            platform:vkms) driver="vkms" ;;
            pci:*) driver="pci" ;;
            *) driver="unknown" ;;
        esac
    fi
    echo "Detected card $node_name (driver: $driver)"
    case "$driver" in
        nvidia|i915|xe|amdgpu|radeon) HARDWARE_GPU_FOUND=true ;;
        vkms) VKMS_CARD="/dev/dri/$node_name" ;;
    esac
done

if [ "$HARDWARE_GPU_FOUND" = "true" ]; then
    echo "Hardware GPU detected, using auto renderer and backend selection"
else
    if [ -n "$VKMS_CARD" ]; then
        echo "No hardware GPU, using vkms virtual GPU with software rendering: $VKMS_CARD"
        # Use the vkms card as DRM backend device: its connector provides the
        # display output, Mesa renders with llvmpipe over GBM
        export WLR_DRM_DEVICES=$VKMS_CARD
        export WLR_RENDERER_ALLOW_SOFTWARE=1
        # Do not add an extra headless output: the vkms connector is the output
        unset WLR_HEADLESS_OUTPUTS
    else
        echo "WARNING: no usable DRM device (hardware GPU or vkms), compositor will use pixman renderer and Sunshine capture may not work"
    fi
fi

# Apply initial screen resolution once the compositor is accepting clients.
# Background subshell: it must run while labwc is starting and re-runs on
# every compositor restart (supervisor restarts labwc on crash).
# NOTE: a stale socket from a previous compositor run may still exist: retry
# the resolution setup until the compositor actually answers.
(
    for i in $(seq 1 100); do
        if [ -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]; then
            break
        fi
        sleep 0.2
    done
    export SUNSHINE_CLIENT_WIDTH=${CLOUDYPAD_SCREEN_INITIAL_WIDTH:-1920}
    export SUNSHINE_CLIENT_HEIGHT=${CLOUDYPAD_SCREEN_INITIAL_HEIGHT:-1080}
    export SUNSHINE_CLIENT_FPS=${CLOUDYPAD_SCREEN_INITIAL_FPS:-60}
    for i in $(seq 1 20); do
        if setup-sunshine-screen-mode.sh; then
            break
        fi
        echo "WARNING: failed to set initial screen resolution (attempt $i/20), retrying..."
        sleep 1
    done
) &

echo "Starting labwc compositor (config dir: $XDG_CONFIG_HOME/labwc, WAYLAND_DISPLAY=$WAYLAND_DISPLAY)"

exec labwc