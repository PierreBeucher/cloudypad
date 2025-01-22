#!/usr/bin/env bash

set -e

#
# Setup X config on container startup depending on available drivers and GPU
#

if [ "$NVIDIA_ENABLE" == "true" ]; then
    echo "NVIDIA driver is enabled (NVIDIA_ENABLE=$NVIDIA_ENABLE). Copying nvidia X config to Xorg config path /etc/X11/xorg.conf..."
    cp $CLOUDYPAD_CONF_DIR/x11/xorg-nvidia-dummy-display.conf /etc/X11/xorg.conf
else
    echo "No GPU config specified. Copying dummy X config to Xorg config path /etc/X11/xorg.conf..."
    cp $CLOUDYPAD_CONF_DIR/x11/xorg-dummy-display.conf /etc/X11/xorg.conf
fi

envsubst < $CLOUDYPAD_CONF_DIR/x11/templates/00-keyboard.conf > /etc/X11/xorg.conf.d/00-keyboard.conf