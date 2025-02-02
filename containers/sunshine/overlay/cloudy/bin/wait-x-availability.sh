#!/usr/bin/env bash

# Wait for X server availability
# Use this script prior to running services requiring an X server

MAX_ATTEMPTS=20
SLEEP_INTERVAL=2

attempt=1

echo "Waiting for X server availability..."

while [ $attempt -le $MAX_ATTEMPTS ]; do
    if xset q >/dev/null 2>&1; then
        echo "X server is available and working."
        exit 0
    else
        echo "Attempt $attempt/$MAX_ATTEMPTS: X server not available. Retrying in $SLEEP_INTERVAL seconds..."
        sleep $SLEEP_INTERVAL
    fi
    attempt=$((attempt + 1))
done

echo "X server is not available after $MAX_ATTEMPTS attempts."
exit 1
