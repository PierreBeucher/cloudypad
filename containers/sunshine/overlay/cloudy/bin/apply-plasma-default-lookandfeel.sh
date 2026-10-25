#!/usr/bin/env bash

#
# Apply the Cloudy Pad default look & feel (Breeze Dark) after the Plasma
# session is up, on fresh instances only.
#
# Why after session start: on a fresh user config, Plasma session startup
# applies the default look & feel (Breeze, light) and overwrites the theme
# files seeded before the session (kdedefaults/*, kdeglobals) - the pre-session
# seed cannot win. Applying via plasma-apply-lookandfeel AFTER the session is
# up is the same code path as System Settings and the result persists across
# container restarts and instance stop/start.
#
# Gated by a flag file written by setup-plasma-default-desktop.sh when the user
# config is fresh (new instance, or CLOUDYPAD_PLASMA_DEFAULT_FORCE in dev).
# The flag lives in XDG_RUNTIME_DIR: wiped on container restart, so this runs
# at most once per fresh instance boot.
#

DEFAULT_LOOKANDFEEL_PACKAGE="org.kde.breezedark.desktop"

FLAG=$XDG_RUNTIME_DIR/cloudypad-apply-plasma-default-lookandfeel
if [ ! -f "$FLAG" ]; then
    exit 0
fi

echo "Fresh Plasma config detected: waiting for session to apply default look & feel..."

# Wait for plasmashell (up to 120s)
PLASMASHELL_UP=false
for i in $(seq 1 60); do
    if pgrep -x plasmashell > /dev/null 2>&1; then
        PLASMASHELL_UP=true
        break
    fi
    sleep 2
done

if [ "$PLASMASHELL_UP" != "true" ]; then
    echo "Warning: plasmashell did not start within timeout, cannot apply default look & feel" >&2
    exit 1
fi

# Let the session settle: the default (light) look & feel is applied during
# session startup, give it time to complete before overriding
sleep 10

source export-dbus-address.sh

if plasma-apply-lookandfeel --apply "$DEFAULT_LOOKANDFEEL_PACKAGE"; then
    echo "Default look & feel applied: $DEFAULT_LOOKANDFEEL_PACKAGE"
    rm -f "$FLAG"
else
    echo "Warning: failed to apply default look & feel $DEFAULT_LOOKANDFEEL_PACKAGE" >&2
fi
