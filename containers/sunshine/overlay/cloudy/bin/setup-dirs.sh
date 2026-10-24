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
    $CLOUDYPAD_USER_HOME

# Sunshine resolves its appdata dir (apps.json, assets, covers) from
# XDG_CONFIG_HOME/sunshine. Its config and assets are Cloudy Pad-managed
# (shipped in image and re-rendered at start in the ephemeral conf dir):
# symlink the appdata path to the Cloudy Pad conf dir instead of duplicating
# files, so XDG_CONFIG_HOME can point to the persisted user home
ln -sfn $CLOUDYPAD_CONF_DIR/sunshine $XDG_CONFIG_HOME/sunshine

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
