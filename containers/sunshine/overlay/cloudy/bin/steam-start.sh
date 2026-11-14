#!/usr/bin/env bash

wait-x-availability.sh

source export-dbus-address.sh

echo "Starting Steam with args: $@"

# Copy default Steam config to enable Proton globally if not already present
if [ ! -f $CLOUDYPAD_DATA_DIR/Steam/config/config.vdf ]; then
    mkdir -p $CLOUDYPAD_DATA_DIR/Steam/config
    cp $CLOUDYPAD_CONF_DIR/steam/config.vdf $CLOUDYPAD_DATA_DIR/Steam/config/config.vdf
    chmod 0644 $CLOUDYPAD_DATA_DIR/Steam/config/config.vdf
fi

echo
echo "========================================="
echo 
echo "STARTING STEAM... UPDATE MAY TAKE A FEW SECONDS TO PROCEED"
echo
echo "========================================="
echo

# Steam is detached from the calling terminal session so its parent may close
# at any time without killing Steam (terminal close sends SIGHUP to the
# session's process group). Used by the desktop launcher, which shows
# this script's output as a console log viewer: it closes automatically when
# Steam exits (tail --pid). Logs are kept in a file so closing the console
# never loses them. Sunshine app launch (apps.json) and direct calls run the
# same flow without any console to display it.
STEAM_LOG="${CLOUDYPAD_LOG_DIR:-/cloudy/log}/steam-user.log"
setsid steam "$@" >> "$STEAM_LOG" 2>&1 &
STEAM_PID=$!
tail -n 50 --pid="$STEAM_PID" -f "$STEAM_LOG"