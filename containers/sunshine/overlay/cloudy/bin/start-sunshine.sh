#!/usr/bin/env bash

wait-wayland-availability.sh

# Ensure Sunshine state directory exists
mkdir -p $CLOUDYPAD_DATA_DIR/sunshine

# Templatise sunshine.conf with env variables
envsubst < $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf.template > $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf

# Append software rendering config if the compositor selected a software
# rendering path (vkms virtual GPU): Sunshine DMA-BUF import must use the
# same DRM card as the compositor (see start-labwc.sh)
if [ -f $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf ]; then
    cat $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf >> $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf
    echo "Appended software rendering config to sunshine.conf: $(cat $CLOUDYPAD_CONF_DIR/sunshine/software-rendering.conf)"
fi

# CSRF protection (Sunshine 2026+): Web UI actions (PIN pairing) require
# explicit origin allowlist, origin_web_ui_allowed=lan is not enough.
# Allow localhost and every container IP: clients reach the Web UI through
# any of them (host network forwarding, LAN address...)
CSRF_ORIGINS="https://localhost:47990,https://127.0.0.1:47990"
for ip in $(hostname -I); do
    CSRF_ORIGINS="$CSRF_ORIGINS,https://$ip:47990"
done
echo "csrf_allowed_origins = $CSRF_ORIGINS" >> $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf
echo "CSRF allowed origins: $CSRF_ORIGINS"

# Set credentials if both Sunshine Web UI password and username are present
if [[ -n "$SUNSHINE_WEB_PASSWORD_BASE64" && -n "$SUNSHINE_WEB_USERNAME" ]]; then
    SUNSHINE_WEB_PASSWORD=$(echo "$SUNSHINE_WEB_PASSWORD_BASE64" | base64 -d)
    sunshine $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf --creds $SUNSHINE_WEB_USERNAME $SUNSHINE_WEB_PASSWORD
fi

sunshine $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf
