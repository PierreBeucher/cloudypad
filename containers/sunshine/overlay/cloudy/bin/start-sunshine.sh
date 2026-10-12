#!/usr/bin/env bash

wait-x-availability.sh

# Ensure Sunshine state directory exists
mkdir -p $CLOUDYPAD_DATA_DIR/sunshine

# Templatise sunshine.conf with env variables
envsubst < $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf.template > $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf

# Ensure the rendered config ends with a newline: envsubst drops the template
# trailing newline when the last line is a variable (eg. additional config),
# which would glue appended lines onto it
[ -n "$(tail -c 1 $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf)" ] && echo >> $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf

# CSRF protection (Sunshine 2026+): Web UI actions (PIN pairing) require
# an explicit origin allowlist, origin_web_ui_allowed=lan is not enough.
# Render a single csrf_allowed_origins line (duplicate keys in the config
# would be resolved last-key-wins): localhost variants + every container IP
# (clients may reach the Web UI through any of them) + extra origins from
# CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS (eg. NAT/port-forwarding addresses
# such as the Vagrant VM LAN IP, unreachable from the container)
CSRF_ORIGINS="https://localhost:47990,https://127.0.0.1:47990"
for ip in $(hostname -I); do
    CSRF_ORIGINS="$CSRF_ORIGINS,https://$ip:47990"
done
if [ -n "$CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS" ]; then
    CSRF_ORIGINS="$CSRF_ORIGINS,$CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS"
fi
echo "csrf_allowed_origins = $CSRF_ORIGINS" >> $CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf
echo "CSRF allowed origins: $CSRF_ORIGINS"

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