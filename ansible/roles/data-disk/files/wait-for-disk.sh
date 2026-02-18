#!/bin/bash

#
# Wait for disk with given ID to be available using specified lookup method
#

set -euo pipefail

DISK_ID="${1:-}"
LOOKUP_METHOD="${2:-default}"
TIMEOUT="${3:-180}"
INTERVAL=2
ELAPSED=0

if [ -z "$DISK_ID" ]; then
    echo "Error: DISK_ID is required" >&2
    echo "Usage: $0 <disk_id> [lookup_method] [timeout]" >&2
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GET_DISK_ID_SCRIPT="$SCRIPT_DIR/get-disk-id.sh"

echo "Waiting for disk (ID: $DISK_ID, Method: $LOOKUP_METHOD, Timeout: ${TIMEOUT}s)..." >&2

while [ $ELAPSED -lt $TIMEOUT ]; do
    # Try to get the disk device path
    if DEVICE_PATH=$("$GET_DISK_ID_SCRIPT" "$DISK_ID" "$LOOKUP_METHOD" 2>/dev/null); then
        echo "Found disk: $DEVICE_PATH" >&2
        echo "$DEVICE_PATH"
        exit 0
    fi

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Error: Disk with ID $DISK_ID not found within ${TIMEOUT}s timeout using method: $LOOKUP_METHOD" >&2
exit 1