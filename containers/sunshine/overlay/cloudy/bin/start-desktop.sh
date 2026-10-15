#!/usr/bin/env bash

wait-x-availability.sh

# Run an independent dbus session and save address to file
# As some process will need to communicate with the desktop session dbus
# (eg. on Sunshine session start to update settings)
export DBUS_SESSION_BUS_ADDRESS=$(dbus-daemon --session --print-address --fork)
echo $DBUS_SESSION_BUS_ADDRESS > "$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address"

echo "Starting Plasma desktop (X11 session) with bus address: $DBUS_SESSION_BUS_ADDRESS"

# Seed default Plasma config (task manager launchers etc.) BEFORE the
# session starts: plasmashell loads the config at startup. Only seeds when
# missing - user customizations are preserved on restart
setup-plasma-default-desktop.sh

# Rebuild the KSycoca services cache BEFORE starting the session:
# plasmashell loads the cache at startup (and caches service lookups),
# a stale cache makes task manager launcher pins render blank/broken.
# cloudypad-*.desktop launchers live in XDG_DATA_DIRS (see Dockerfile).
# kbuildsycoca6 on Plasma 6 (KF6), kbuildsycoca5 on Plasma 5
echo "Rebuilding KSycoca services cache..."
KSYCOCA_BIN=$(command -v kbuildsycoca6 || command -v kbuildsycoca5 || true)
if [ -n "$KSYCOCA_BIN" ]; then
    $KSYCOCA_BIN || echo "Warning: $KSYCOCA_BIN failed, launchers may render blank"
else
    echo "Warning: kbuildsycoca not found, launchers may render blank"
fi

# Plasma X11 session on the Xorg-dummy display
# (startplasma-x11 wires the session: kwin_x11 WM, plasmashell, plasma-workspace)
startplasma-x11 &
PLASMA_PID=$!

# Wait for Plasma session process
wait $PLASMA_PID