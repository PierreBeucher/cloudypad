#!/bin/bash

# Wait for udev daemon availability
# Use this script prior to running services requiring udev daemon (eg. desktop manager)

MAX_ATTEMPTS=20
SLEEP_INTERVAL=1

attempt=1

echo "Waiting for udev daemon to be fully started..."

while [ $attempt -le $MAX_ATTEMPTS ]; do
    if udevadm control --ping >/dev/null 2>&1; then
        echo "udev daemon is running."

        # This will ensure all events have been processed
        # eg. all devices event have been handled to ensure all devices are properly registered
        udevadm settle
        echo "udev daemon is fully ready."

        exit 0
    else
        echo "Attempt $attempt/$MAX_ATTEMPTS: udev daemon not ready. Retrying in $SLEEP_INTERVAL seconds..."
        sleep $SLEEP_INTERVAL
    fi
    attempt=$((attempt + 1))
done

echo "udev daemon did not start after $MAX_ATTEMPTS attempts."
exit 1
