#!/usr/bin/env bash

#
# Start the desktop panel (waybar) as a supervised service
#

set -e

wait-wayland-availability.sh

echo "Starting waybar panel"

exec waybar \
    -c $XDG_CONFIG_HOME/waybar/config.jsonc \
    -s $XDG_CONFIG_HOME/waybar/style.css