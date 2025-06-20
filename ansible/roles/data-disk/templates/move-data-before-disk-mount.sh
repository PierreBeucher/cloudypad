#!/bin/bash

set -e

# Templated by Ansible
CLOUDYPAD_DATA_ROOT="{{ cloudypad_data_root }}"
CLOUDYPAD_DATA_TEMP_DIR="{{ cloudypad_data_root }}-tmp-before-mount"

# Check if data root directory exists and is not empty
if [ -d "$CLOUDYPAD_DATA_ROOT" ]; then
    
    # Check if directory is empty (including hidden files)
    if [ -z "$(ls -A "$CLOUDYPAD_DATA_ROOT" 2>/dev/null)" ]; then
        echo "Data root directory is empty, no need to move data"
        exit 0
    fi
    
    # # Check if already a mountpoint
    # ENABLE ME !!!
    # if mountpoint -q "$CLOUDYPAD_DATA_ROOT"; then
    #     echo "Data root directory is already a mountpoint, no need to move data"
    #     exit 0
    # fi
    
    echo "Data root directory contains data and is not mounted, moving data to temporary location"
    
    # Try to stop autostop service if running
    if systemctl is-active --quiet cloudypad-autostop; then
        echo "Stopping cloudypad-autostop service"
        systemctl stop cloudypad-autostop || true
    fi
    
    # Try to stop all Docker containers
    if command -v docker >/dev/null 2>&1; then
        echo "Stopping all Docker containers"
        docker stop $(docker ps -q) 2>/dev/null || true
    fi
    
    # Create temp directory
    mkdir -p "$CLOUDYPAD_DATA_TEMP_DIR"
    
    # Move data to temp directory
    echo "Moving data from $CLOUDYPAD_DATA_ROOT to $CLOUDYPAD_DATA_TEMP_DIR"
    mv "$CLOUDYPAD_DATA_ROOT"/* "$CLOUDYPAD_DATA_TEMP_DIR/" 2>/dev/null || true
    mv "$CLOUDYPAD_DATA_ROOT"/.* "$CLOUDYPAD_DATA_TEMP_DIR/" 2>/dev/null || true
    
    echo "Data moved successfully"
else
    echo "Data root directory does not exist, no need to move data"
fi 