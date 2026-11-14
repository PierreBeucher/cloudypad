#!/usr/bin/env bash

wait-x-availability.sh

# Sunshine appdata dir: Sunshine resolves everything relative to it (main
# config). It lives in the persisted user home: user state survives container
# recreation and instance restarts. Apps list itself comes from the image via
# the file_apps config (see sunshine.conf.template).
APPDATA=$XDG_CONFIG_HOME/sunshine
mkdir -p $APPDATA

# Sunshine state directory (cert, pkey, pairing state, credentials), pinned
# to the persisted data dir via sunshine.conf
mkdir -p $CLOUDYPAD_DATA_DIR/sunshine

# Capture backend default: x11 unless overridden by compose env (nvfbc on
# datacenter and professional GPUs, see docker-compose.nvidia.yml). Defaults here so a stale
# compose file without the var doesn't render an empty capture setting and
# let Sunshine fall back to its broken-in-container KMS auto-probe.
export CLOUDYPAD_SUNSHINE_CAPTURE=${CLOUDYPAD_SUNSHINE_CAPTURE:-x11}

# Compute the CSRF allowed origins list before rendering the config:
# Sunshine 2026+ Web UI actions (PIN pairing) require an explicit origin
# allowlist, origin_web_ui_allowed=lan is not enough. Built-in localhost
# variants + every container IP (clients may reach the Web UI through any
# of them) + extra origins from CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS
# (eg. NAT/port-forwarding addresses such as the Vagrant VM LAN IP,
# unreachable from the container)
CSRF_ORIGINS="https://localhost:47990,https://127.0.0.1:47990"
for ip in $(hostname -I); do
    CSRF_ORIGINS="$CSRF_ORIGINS,https://$ip:47990"
done
if [ -n "$CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS" ]; then
    CSRF_ORIGINS="$CSRF_ORIGINS,$CLOUDYPAD_SUNSHINE_CSRF_ALLOWED_ORIGINS"
fi
export CLOUDYPAD_SUNSHINE_CSRF_ORIGINS="$CSRF_ORIGINS"
echo "CSRF allowed origins: $CSRF_ORIGINS"

# Ensure every variable referenced by sunshine.conf.template is set:
# envsubst renders unset variables as empty strings, which would silently
# produce an invalid config (eg. "capture = " breaking Sunshine's capture
# auto-probe). Fail hard instead, listing all missing variables.
# NOTE: keep the list below in sync with the template variables. Using an
# explicit list over automatic template parsing keeps the contract visible
# and avoids grepping the template at runtime.
MISSING_VARS=""
if [[ -z "${SUNSHINE_SERVER_NAME+x}" ]]; then MISSING_VARS="$MISSING_VARS SUNSHINE_SERVER_NAME"; fi
if [[ -z "${CLOUDYPAD_SUNSHINE_CAPTURE+x}" ]]; then MISSING_VARS="$MISSING_VARS CLOUDYPAD_SUNSHINE_CAPTURE"; fi
if [[ -z "${CLOUDYPAD_SUNSHINE_MAX_BITRATE+x}" ]]; then MISSING_VARS="$MISSING_VARS CLOUDYPAD_SUNSHINE_MAX_BITRATE"; fi
if [[ -z "${CLOUDYPAD_SUNSHINE_CSRF_ORIGINS+x}" ]]; then MISSING_VARS="$MISSING_VARS CLOUDYPAD_SUNSHINE_CSRF_ORIGINS"; fi
if [[ -z "${CLOUDYPAD_SUNSHINE_ADDITIONAL_CONFIG+x}" ]]; then MISSING_VARS="$MISSING_VARS CLOUDYPAD_SUNSHINE_ADDITIONAL_CONFIG"; fi
if [[ -n "$MISSING_VARS" ]]; then
    echo "ERROR: sunshine.conf.template references unset variables:$MISSING_VARS. The Sunshine container environment must provide them all (see ansible/roles/sunshine/templates/docker-compose.yml)" >&2
    exit 1
fi

# Render sunshine.conf into the appdata dir (Sunshine's default config
# location) and pass it explicitly to the binary
CONFIG=$APPDATA/sunshine.conf
envsubst < "$CLOUDYPAD_CONF_DIR/sunshine/sunshine.conf.template" > $CONFIG

# Set credentials if both Sunshine Web UI password and username are present
if [[ -n "$SUNSHINE_WEB_PASSWORD_BASE64" && -n "$SUNSHINE_WEB_USERNAME" ]]; then
    SUNSHINE_WEB_PASSWORD=$(echo "$SUNSHINE_WEB_PASSWORD_BASE64" | base64 -d)
    sunshine $CONFIG --creds $SUNSHINE_WEB_USERNAME $SUNSHINE_WEB_PASSWORD
fi

# exec so the supervised process IS sunshine (supervisorctl tracks its real
# PID; without exec, restarts leave the shell tracked while Sunshine survives
# as an orphan holding the protocol ports)
exec sunshine $CONFIG
