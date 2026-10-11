#!/usr/bin/env bash

#
# Start the desktop wallpaper (swaybg) as a supervised service
#

set -e

wait-wayland-availability.sh

echo "Starting wallpaper (swaybg)"

# swaybg does not handle SVG, wallpaper image is rasterized at build time
exec swaybg -i /usr/share/cloudypad/wallpaper.png -m fill