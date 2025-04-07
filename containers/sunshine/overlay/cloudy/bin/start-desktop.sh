#!/usr/bin/env bash

wait-x-availability.sh

# Run an independent dbus session and save address to file
# As some process will need to communicate with xfce4's dbus to update settings
# (eg. on Sunshine session start to update desktop icon size)
export DBUS_SESSION_BUS_ADDRESS=$(dbus-daemon --session --print-address --fork)
echo $DBUS_SESSION_BUS_ADDRESS > "$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address"

echo "Starting xfce4 desktop with bus address: $DBUS_SESSION_BUS_ADDRESS"

# Shows a bunch of warning but at least doesn't crash ¯\_(ツ)_/¯
startxfce4