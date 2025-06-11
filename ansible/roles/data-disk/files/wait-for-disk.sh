#!/bin/bash

#
# Wait for disk with given ID to be available
#

TARGET_ID="$1"
TIMEOUT=${2:-180}
INTERVAL=2
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do

    for id in /dev/disk/by-id/*; do
        if [[ "$id" == *"$TARGET_ID" ]]; then
            real_dev=$(readlink -f "$id")
            echo "Found disk: $(basename "$real_dev")"
            exit 0
        fi
    done

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Device with ID $TARGET_ID not found within timeout" >&2
exit 1