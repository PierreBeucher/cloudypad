#!/usr/bin/env bash

#
# Setup directories and permissions
# eg. XDG_* directories and some devices permissions
# 

# Ensure /dev/uinput usable by all processes, required to properly handle mouse and keyboard
# Only if present: not passed to container when running locally without device
if [ -e /dev/uinput ]; then
    chmod 0666 /dev/uinput
fi

# Ensure DRM devices usable by all processes: compositor opens DRM devices
# directly (O_RDWR) as the runtime user, not through seatd
if ls /dev/dri/renderD* >/dev/null 2>&1; then
    chmod 0666 /dev/dri/renderD*
fi
if ls /dev/dri/card[0-9]* >/dev/null 2>&1; then
    chmod 0666 /dev/dri/card[0-9]*
fi

# Ensure required directories exist and are usable by Cloudy user (XDG_*, Home directories, etc.)
# As these directories are designed to be mounted from host, we need to ensure they exist and are usable by Cloudy user
# since container runtime like Docker would typically mount them with root:root ownership and unwanted permissions
mkdir -p \
    $CLOUDYPAD_DATA_DIR \
    $CLOUDYPAD_LOG_DIR \
    $XDG_RUNTIME_DIR \
    $XDG_CACHE_HOME \
    $XDG_CONFIG_HOME \
    $XDG_DATA_HOME \
    $CLOUDYPAD_USER_HOME

chown $CLOUDYPAD_USER:$CLOUDYPAD_USER \
    $CLOUDYPAD_DATA_DIR \
    $CLOUDYPAD_LOG_DIR \
    $XDG_RUNTIME_DIR \
    $XDG_CACHE_HOME \
    $XDG_CONFIG_HOME \
    $XDG_DATA_HOME \
    $CLOUDYPAD_USER_HOME

chmod 0700 \
    $CLOUDYPAD_DATA_DIR \
    $CLOUDYPAD_LOG_DIR \
    $XDG_RUNTIME_DIR \
    $XDG_CACHE_HOME \
    $XDG_CONFIG_HOME \
    $XDG_DATA_HOME \
    $CLOUDYPAD_USER_HOME
