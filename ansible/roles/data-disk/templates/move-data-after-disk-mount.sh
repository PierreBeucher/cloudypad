#!/bin/bash

set -e

# Templated by Ansible
CLOUDYPAD_DATA_ROOT="{{ cloudypad_data_root }}"
CLOUDYPAD_DATA_TEMP_DIR="{{ cloudypad_data_root }}-tmp-before-mount"

# Check if temp directory exists and is not empty
if [ -d "$CLOUDYPAD_DATA_TEMP_DIR" ]; then
    
    if [ -z "$(ls -A "$CLOUDYPAD_DATA_TEMP_DIR" 2>/dev/null)" ]; then
        echo "Temp directory is empty, removing it"
        rmdir "$CLOUDYPAD_DATA_TEMP_DIR"
        exit 0
    fi
    
    echo "Moving data back from $CLOUDYPAD_DATA_TEMP_DIR to $CLOUDYPAD_DATA_ROOT"
    
    # Move data back from temp directory
    mv "$CLOUDYPAD_DATA_TEMP_DIR"/* "$CLOUDYPAD_DATA_ROOT/" 2>/dev/null || true
    mv "$CLOUDYPAD_DATA_TEMP_DIR"/.* "$CLOUDYPAD_DATA_ROOT/" 2>/dev/null || true
    
    # Remove temp directory
    rmdir "$CLOUDYPAD_DATA_TEMP_DIR"
    
    # Start back autostop service if it was running before
    if systemctl is-enabled --quiet cloudypad-autostop; then
        echo "Starting cloudypad-autostop service"
        systemctl start cloudypad-autostop || true
    else
        echo "cloudypad-autostop not found, not starting it. Above error on get unit file status can be ignored."
    fi

    echo "Data moved back successfully !"
    
else
    echo "Temp directory does not exist, no data to move back"
fi 