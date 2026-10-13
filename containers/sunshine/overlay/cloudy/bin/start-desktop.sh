#!/usr/bin/env bash

wait-x-availability.sh

# Run an independent dbus session and save address to file
# As some process will need to communicate with the desktop session dbus
# (eg. on Sunshine session start to update settings)
export DBUS_SESSION_BUS_ADDRESS=$(dbus-daemon --session --print-address --fork)
echo $DBUS_SESSION_BUS_ADDRESS > "$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address"

echo "Starting Plasma desktop (X11 session) with bus address: $DBUS_SESSION_BUS_ADDRESS"

# Plasma X11 session on the Xorg-dummy display
# (startplasma-x11 wires the session: kwin_x11 WM, plasmashell, plasma-workspace)
startplasma-x11 &
PLASMA_PID=$!

# Apply Cloudy Pad desktop defaults once plasmashell is up:
# wallpaper + task manager launchers (additive, see script header)
setup-plasma-default-desktop.sh

# Wait for Plasma session process
wait $PLASMA_PID