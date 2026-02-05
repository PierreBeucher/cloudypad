#!/bin/bash
# Get disk device path based on lookup method and disk identifier
# Outputs device path to stdout (e.g., /dev/sda)
# All other output goes to stderr

set -euo pipefail

DISK_ID="${1:-}"
LOOKUP_METHOD="${2:-default}"

if [ -z "$DISK_ID" ]; then
    echo "Error: DISK_ID is required" >&2
    exit 1
fi

case "$LOOKUP_METHOD" in
    "azure_lun")
        # Azure LUN-based lookup
        # DISK_ID should be the LUN number (e.g., "0")
        DEVICE_PATH="/dev/disk/azure/scsi1/lun${DISK_ID}"
        
        if [ -L "$DEVICE_PATH" ]; then
            # Resolve symlink to actual device
            REAL_DEVICE=$(readlink -f "$DEVICE_PATH")
            echo "$REAL_DEVICE"
            exit 0
        else
            echo "Error: Azure LUN device not found: $DEVICE_PATH" >&2
            exit 1
        fi
        ;;
        
    "default")
        # Default method: match by disk ID in /dev/disk/by-id/
        # Search for the disk ID in various by-id paths
        # For AWS: looks for vol-{id}
        # For Scaleway: looks for UUID part
        # For GCP: looks for google-{disk-name}
        for id_path in /dev/disk/by-id/*; do
            if [[ "$id_path" == *"$DISK_ID"* ]]; then
                REAL_DEVICE=$(readlink -f "$id_path")
                echo "$REAL_DEVICE"
                exit 0
            fi
        done
        
        echo "Error: Disk not found with ID: $DISK_ID" >&2
        exit 1
        ;;
        
    *)
        echo "Error: Unknown lookup method: $LOOKUP_METHOD" >&2
        echo "Supported methods: default, azure_lun" >&2
        exit 1
        ;;
esac

