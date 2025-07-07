#!/usr/bin/env bash

#
# Sync file from /cloudy/conf/xfce4-default to /cloudy/conf/xfce4
# Since /cloudy/conf/xfce4 is bind-mounted, we want to setup default config when it's not already done
# and keep user's customizations in bind mounted directory
#

# Copy file from /cloudy/conf/xfce4-default to /cloudy/conf/xfce4
# Override any existing file in /cloudy/conf/xfce4
# User customizations like keyboard-layout.xml or displays.xml should not be overridden
#
# Note: this algorithm is not perfect but should be good enough for now for most cases

echo "Setting up default xfce4 config"

XFCE4_CONFIG_DIR=$XDG_CONFIG_HOME/xfce4

mkdir -p $XFCE4_CONFIG_DIR
cp -r $XDG_CONFIG_HOME/xfce4-default/* $XFCE4_CONFIG_DIR/

# Ensure ownership of xfce4 config is set to Cloudy user
chown -R $CLOUDYPAD_USER:$CLOUDYPAD_USER $XFCE4_CONFIG_DIR

echo "Default xfce4 config setup complete"