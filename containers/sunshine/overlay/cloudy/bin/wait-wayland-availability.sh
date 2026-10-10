#!/usr/bin/env bash

# Wait for Wayland compositor availability
# Use this script prior to running services requiring a Wayland display

MAX_ATTEMPTS=20
SLEEP_INTERVAL=2

attempt=1

echo "Waiting for Wayland compositor availability ($WAYLAND_DISPLAY)..."

while [ $attempt -le $MAX_ATTEMPTS ]; do
    if wayland-info >/dev/null 2>&1; then
        echo "Wayland compositor is available and working."
        exit 0
    else
        echo "Attempt $attempt/$MAX_ATTEMPTS: Wayland compositor not available. Retrying in $SLEEP_INTERVAL seconds..."
        sleep $SLEEP_INTERVAL
    fi
    attempt=$((attempt + 1))
done

echo "Wayland compositor is not available after $MAX_ATTEMPTS attempts."
exit 1
