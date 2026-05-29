#!/usr/bin/env bash

wait-x-availability.sh

MOONDECKBUDDY_APPIMAGE_PATH="/opt/MoonDeckBuddy/MoonDeckBuddy.AppImage"

if [ ! -x "$MOONDECKBUDDY_APPIMAGE_PATH" ]; then
  echo "MoonDeckBuddy AppImage not found at $MOONDECKBUDDY_APPIMAGE_PATH"
  exit 1
fi

cd "$CLOUDYPAD_USER_HOME"

"$MOONDECKBUDDY_APPIMAGE_PATH" --exec MoonDeckStream &

MOONDECKSTREAM_PID=$!
echo $MOONDECKSTREAM_PID > /tmp/moondeckstream.pid
echo "MoonDeckStream started with PID: $MOONDECKSTREAM_PID"

wait $MOONDECKSTREAM_PID
