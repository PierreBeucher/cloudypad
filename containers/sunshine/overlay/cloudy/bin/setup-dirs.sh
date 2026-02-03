#!/usr/bin/env bash

#
# Setup directories and permissions
# eg. XDG_* directories and some devices permissions
# 

# Ensure /dev/uinput usable by all processes, required to properly handle mouse and keyboard
# TODO is this secure ?
chmod 0666 /dev/uinput

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
    $CLOUDYPAD_USER_HOME \
    $CLOUDYPAD_USER_HOME/Desktop

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

# Copy desktop shortcuts to user's Desktop
if [ -d "/cloudy/conf/desktop-shortcuts" ]; then
    cp /cloudy/conf/desktop-shortcuts/*.desktop $CLOUDYPAD_USER_HOME/Desktop/ 2>/dev/null || true
    chown -R $CLOUDYPAD_USER:$CLOUDYPAD_USER $CLOUDYPAD_USER_HOME/Desktop
    chmod 755 $CLOUDYPAD_USER_HOME/Desktop/*.desktop 2>/dev/null || true
fi
