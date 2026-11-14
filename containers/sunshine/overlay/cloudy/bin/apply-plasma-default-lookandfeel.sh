#!/usr/bin/env bash

#
# Apply the Cloudy Pad default look & feel (Breeze Dark) after the Plasma
# session is up, exactly once per instance.
#
# Why after session start: on a fresh user config, Plasma session startup
# applies the default look & feel (Breeze, light) and overwrites any pre-session
# theme seeding - the pre-session seed cannot win. Applying via
# plasma-apply-lookandfeel AFTER the session is
# up is the same code path as System Settings and the result persists across
# container restarts and instance stop/start.
#
# The decision is driven by persisted markers in $XDG_CONFIG_HOME/cloudypad,
# raised by setup-plasma-default-desktop.sh (see its header):
# - plasma-lookandfeel-pending: the default look & feel has not been decided
#   yet. Persisted: a boot interrupted before the apply completed is retried
#   on next start, until it succeeds.
# - plasma-lookandfeel-applied: the decision is final (applied, or skipped as
#   a user customization). Setup stops raising pending once it exists.
#
# Re-applying the same look & feel package is harmless: a container killed
# between a successful apply and the marker write simply re-applies on next
# start.
#

DEFAULT_LOOKANDFEEL_PACKAGE="org.kde.breezedark.desktop"
PLASMA_STOCK_LOOKANDFEEL_PACKAGE="org.kde.breeze.desktop"

MARKER_DIR=$XDG_CONFIG_HOME/cloudypad
PENDING_MARKER=$MARKER_DIR/plasma-lookandfeel-pending
APPLIED_MARKER=$MARKER_DIR/plasma-lookandfeel-applied

if [ ! -f "$PENDING_MARKER" ]; then
    exit 0
fi

echo "Pending default look & feel detected: waiting for session to apply it..."

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

# Let the session settle: the stock (light) look & feel is applied during
# session startup, give it time to complete before overriding
sleep 10

source export-dbus-address.sh

# Write the final decision marker and clear the pending one
mark_decision_final() {
    mkdir -p "$MARKER_DIR"
    touch "$APPLIED_MARKER"
    rm -f "$PENDING_MARKER"
}

# A look & feel differing from the stock Plasma default is a user choice:
# keep it and mark the decision final so the Cloudy Pad default never
# overrides it. Empty or stock value means the config was never customized:
# safe to apply the Cloudy Pad default.
CURRENT_LOOKANDFEEL=$(kreadconfig6 --file kdeglobals --group KDE --key LookAndFeelPackage 2>/dev/null || true)

if [ -n "$CURRENT_LOOKANDFEEL" ] && [ "$CURRENT_LOOKANDFEEL" != "$PLASMA_STOCK_LOOKANDFEEL_PACKAGE" ]; then
    echo "Custom look & feel '$CURRENT_LOOKANDFEEL' detected: keeping it, marking Cloudy Pad default as skipped"
    mark_decision_final
    exit 0
fi

if plasma-apply-lookandfeel --apply "$DEFAULT_LOOKANDFEEL_PACKAGE"; then
    echo "Default look & feel applied: $DEFAULT_LOOKANDFEEL_PACKAGE"
    mark_decision_final
else
    echo "Warning: failed to apply default look & feel $DEFAULT_LOOKANDFEEL_PACKAGE, will retry on next start" >&2
    exit 1
fi
