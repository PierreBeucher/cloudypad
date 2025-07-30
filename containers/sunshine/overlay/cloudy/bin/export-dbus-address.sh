#!/usr/bin/env bash

# A DBUS session is started by supervisor desktop service on container startup
# Try to export DBUS_SESSION_BUS_ADDRESS to Sunshine if it exists
if [ -f "$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address" ]; then
    export DBUS_SESSION_BUS_ADDRESS=$(cat $XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address)
    echo "Found DBUS session bus address file: $XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address. Exporting DBUS_SESSION_BUS_ADDRESS='$DBUS_SESSION_BUS_ADDRESS'..."
else
    echo "WARNING: $XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address does not exist. Can't set DBUS_SESSION_BUS_ADDRESS."
fi