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

# Pin wlroots backends: headless (virtual display output) + libinput (input
# devices). Without the pin, an available seat could make wlroots try the DRM
# backend and fail on missing KMS master in the container.
export WLR_BACKENDS=headless,libinput

# Sunshine virtual input devices only appear after a client connects:
# starting with zero input devices is fine (single headless output created)
export WLR_LIBINPUT_NO_DEVICES=1

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

# Apply initial screen resolution once the compositor is accepting clients.
# Background subshell: it must run while labwc is starting and re-runs on
# every compositor restart (supervisor restarts labwc on crash)
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
    setup-sunshine-screen-mode.sh || echo "WARNING: failed to set initial screen resolution"
) &

echo "Starting labwc compositor (config dir: $XDG_CONFIG_HOME/labwc, WAYLAND_DISPLAY=$WAYLAND_DISPLAY)"

exec labwc