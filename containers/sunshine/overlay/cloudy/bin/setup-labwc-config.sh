#!/usr/bin/env bash

set -e

#
# Setup labwc desktop config
#
# Copy default config from $XDG_CONFIG_HOME/labwc-default and $XDG_CONFIG_HOME/waybar-default
# into $XDG_CONFIG_HOME/labwc and $XDG_CONFIG_HOME/waybar
#
# These directories may be bind-mounted from host: defaults are applied on
# first boot only, user customizations in bind-mounted directories are kept
# across container restarts
#
# Keyboard layout is NOT set here: passed to labwc via XKB_DEFAULT_* environment
# variables from start-labwc.sh
#

echo "Setting up labwc and waybar config"

LABWC_CONFIG_DIR=$XDG_CONFIG_HOME/labwc
WAYBAR_CONFIG_DIR=$XDG_CONFIG_HOME/waybar

if [ ! -f "$LABWC_CONFIG_DIR/rc.xml" ]; then
    echo "No labwc config found, applying default config to $LABWC_CONFIG_DIR"
    mkdir -p $LABWC_CONFIG_DIR
    cp $XDG_CONFIG_HOME/labwc-default/* $LABWC_CONFIG_DIR/
else
    echo "Existing labwc config found, keeping it"
fi

if [ ! -f "$WAYBAR_CONFIG_DIR/config.jsonc" ]; then
    echo "No waybar config found, applying default config to $WAYBAR_CONFIG_DIR"
    mkdir -p $WAYBAR_CONFIG_DIR
    cp $XDG_CONFIG_HOME/waybar-default/* $WAYBAR_CONFIG_DIR/
else
    echo "Existing waybar config found, keeping it"
fi

# Ensure ownership of config is set to Cloudy user
chown -R $CLOUDYPAD_USER:$CLOUDYPAD_USER $LABWC_CONFIG_DIR $WAYBAR_CONFIG_DIR

echo "labwc and waybar config setup complete"