#!/usr/bin/env bash

#
# Start a dbus session bus as a supervised service
# Address is saved for other scripts via export-dbus-address.sh
# (file name kept from XFCE-based image for retrocompatibility)
#

set -e

DBUS_SESSION_ADDRESS=$(dbus-daemon --session --print-address --fork)
echo $DBUS_SESSION_ADDRESS > "$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address"
export DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_ADDRESS

echo "dbus session bus started at: $DBUS_SESSION_ADDRESS"

# dbus-daemon --fork returns, keep supervisor program alive without holding a service process
exec sleep infinity
