#!/usr/bin/env bash

#
# Start seatd: seat management daemon
# Provides libseat session to the compositor (Hyprland) so it can access
# input devices (/dev/input) and DRM devices (/dev/dri) as non-root user
#
# Socket group is set to "video": Cloudy user is in "video" group
# (see setup-user.sh), granting access to the seatd socket
#

set -e

echo "Starting seatd (socket group: video)..."

# Non-VT-bound seat: containers have no VTs, a VT-bound seat would never
# become "active" and wlroots would keep outputs disabled waiting for the
# session activation (pattern from podstage streaming containers)
export SEATD_VTBOUND=0

exec seatd -g video
