#!/usr/bin/env bash

set -e

#
# Start Hyprland Wayland compositor in headless mode
#
# - AQ_NO_KMS_REQUIREMENT: allow starting on render-only GPUs (datacenter NVIDIA, headless)
#   and containers without display outputs
# - Virtual display outputs are created at startup (see hyprland.conf exec-once)
#   and resized on Sunshine session start by setup-sunshine-screen-mode.sh
#

# Explicitly force seatd as libseat backend (no logind in container)
export LIBSEAT_BACKEND=seatd

# Allow running on render-only GPUs (datacenter NVIDIA, headless)
export AQ_NO_KMS_REQUIREMENT=1

# Session environment
export XDG_SESSION_TYPE=wayland
export XDG_CURRENT_DESKTOP=Hyprland
export XDG_SESSION_DESKTOP=Hyprland

# NOTE: no wait-udev-availability.sh here: udevadm control --ping requires root
# (control socket is root-only) and Hyprland does not need udev before starting.
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
        echo "WARNING: seatd socket not found after 30 attempts, starting Hyprland anyway (input may not work)"
    fi
    sleep 1
done

# NOTE: dbus session bus is started as its own supervisor service (dbus-session),
# its address is picked up by scripts via export-dbus-address.sh

echo "Starting Hyprland with config: $CLOUDYPAD_CONF_DIR/hypr/hyprland.conf"

exec Hyprland -c $CLOUDYPAD_CONF_DIR/hypr/hyprland.conf
