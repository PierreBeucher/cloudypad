#!/usr/bin/env bash

#
# Setup directories and permissions
# eg. XDG_* directories and some devices permissions
# 

# Ensure /dev/uinput usable by all processes, required to properly handle mouse and keyboard
# TODO is this secure ?
if [ -e /dev/uinput ]; then
    chmod 0666 /dev/uinput
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

# Don't fail if not possible (e.g. mounted volumes with restrictions)
chmod 0700 \
    $CLOUDYPAD_DATA_DIR \
    $CLOUDYPAD_LOG_DIR \
    $XDG_RUNTIME_DIR \
    $XDG_CACHE_HOME \
    $XDG_CONFIG_HOME \
    $XDG_DATA_HOME \
    $CLOUDYPAD_USER_HOME \
    || true
