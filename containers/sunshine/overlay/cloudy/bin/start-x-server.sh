#!/usr/bin/env bash

# Only the following extensions can be run-time enabled/disabled:
# Generic Event Extension
# MIT-SHM
# XTEST
# SECURITY
# XINERAMA
# XFIXES
# RENDER
# RANDR
# COMPOSITE
# DAMAGE
# MIT-SCREEN-SAVER
# DOUBLE-BUFFER
# RECORD
# DPMS
# X-Resource
# XVideo
# XVideo-MotionCompensation
# SELinux
# GLX

DISPLAY=${DISPLAY:-":42"}
DISPLAY_NUMBER=${DISPLAY#":"}

wait-udev-availability.sh

echo "About to start X server on display: $DISPLAY (display number '$DISPLAY_NUMBER')"

# Check is an old lock file exists
# It should contain existing Xorg process PID (if any)
# Try to stop existing Xorg process before starting a new one
if [ -f /tmp/.X$DISPLAY_NUMBER-lock ]; then
    echo "Old lock file found, trying to stop existing Xorg process..."
    
    X_PID=$(cat /tmp/.X$DISPLAY_NUMBER-lock | tr -d ' ')
    if [ -n "$X_PID" ]; then
        echo "Found existing Xorg process with PID: $X_PID, killing it..."
        kill -KILL $X_PID || true
    else
        echo "No PID found in lock file, removing lock file..."
    fi

    rm /tmp/.X$DISPLAY_NUMBER-lock
else 
    echo "No old /tmp/.X$DISPLAY_NUMBER-lock file found, continuing..."
fi

echo "Starting Xorg..."

# Why both -ext XINERAMA and -xinerama
/usr/bin/Xorg $DISPLAY \
    -ac \
    -noreset \
    -novtswitch \
    +extension RANDR \
    +extension RENDER \
    +extension GLX \
    +extension XVideo \
    +extension DOUBLE-BUFFER \
    +extension SECURITY \
    +extension DAMAGE \
    +extension X-Resource \
    -extension XINERAMA -xinerama \
    +extension Composite \
    +extension COMPOSITE \
    -s off \
    -nolisten tcp \
    -verbose