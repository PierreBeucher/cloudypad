#!/usr/bin/env bash

wait-x-availability.sh

# Ensure Sunshine state directory exists
mkdir -p $CLOUDYPAD_DATA_DIR/sunshine

# Templatise sunshine.conf with env variables
envsubst < $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf.template > $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf

# Set credentials if both Sunshine Web UI password and username are present
if [[ -n "$SUNSHINE_WEB_PASSWORD" && -n "$SUNSHINE_WEB_USERNAME" ]]; then
    sunshine $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf --creds $SUNSHINE_WEB_USERNAME $SUNSHINE_WEB_PASSWORD
fi

sunshine $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf
