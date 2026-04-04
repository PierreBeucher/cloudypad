#!/usr/bin/env bash

wait-x-availability.sh

MOONDECKBUDDY_APPIMAGE_PATH="/opt/MoonDeckBuddy/MoonDeckBuddy.AppImage"

if [ ! -x "$MOONDECKBUDDY_APPIMAGE_PATH" ]; then
    echo "MoonDeckBuddy AppImage not found at $MOONDECKBUDDY_APPIMAGE_PATH"
    exit 1
fi

cd "$CLOUDYPAD_USER_HOME"

exec "$MOONDECKBUDDY_APPIMAGE_PATH"
