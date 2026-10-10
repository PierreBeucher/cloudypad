#!/usr/bin/env bash

set -e

#
# Generate Hyprland config from template, substituting env variables:
# - Keyboard layout, variant, model, options
# - Initial screen resolution
#
# See https://wiki.hypr.land/Configuring/
#

HYPRLAND_CONF_DIR=$CLOUDYPAD_CONF_DIR/hypr

mkdir -p $HYPRLAND_CONF_DIR

echo "Generating Hyprland config from template $CLOUDYPAD_CONF_DIR/hypr/hyprland.conf.template to $HYPRLAND_CONF_DIR/hyprland.conf"

# Only substitute known variables to preserve Hyprland's own config variables (eg. $mod)
envsubst \
    '$CLOUDYPAD_KEYBOARD_LAYOUT $CLOUDYPAD_KEYBOARD_VARIANT $CLOUDYPAD_KEYBOARD_MODEL $CLOUDYPAD_KEYBOARD_OPTIONS $CLOUDYPAD_SCREEN_INITIAL_WIDTH $CLOUDYPAD_SCREEN_INITIAL_HEIGHT $CLOUDYPAD_SCREEN_INITIAL_FPS' \
    < $CLOUDYPAD_CONF_DIR/hypr/hyprland.conf.template > $HYPRLAND_CONF_DIR/hyprland.conf

chown -R $CLOUDYPAD_USER:$CLOUDYPAD_USER $HYPRLAND_CONF_DIR

echo "Hyprland config setup complete"
