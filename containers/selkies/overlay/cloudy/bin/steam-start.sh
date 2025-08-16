#!/usr/bin/env bash

wait-x-availability.sh

source export-dbus-address.sh

echo "Starting Steam with args: $@"

# Copy default Steam config to enable Proton globally if not already present
if [ ! -f $CLOUDYPAD_DATA_DIR/Steam/config/config.vdf ]; then
    mkdir -p $CLOUDYPAD_DATA_DIR/Steam/config
    cp $CLOUDYPAD_CONF_DIR/steam/config.vdf $CLOUDYPAD_DATA_DIR/Steam/config/config.vdf
    chmod 0644 $CLOUDYPAD_DATA_DIR/Steam/config/config.vdf
fi

steam "$@"