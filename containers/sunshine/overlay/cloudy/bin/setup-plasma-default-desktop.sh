#!/usr/bin/env bash

#
# Setup default Plasma desktop configuration (additive):
# - Seed the Plasma panel/task manager config (plasma-org.kde.plasma.desktop-appletsrc)
#   with Cloudy Pad defaults: task manager launchers pinned to Steam, Epic, GOG,
#   Heroic, Lutris, Firefox, Konsole, Files, Keyboard, Mouse, Help, Exit -
#   mirroring the former XFCE bottom dock
#
# Config is seeded from the CLOUDYPAD_CONF_DIR/plasma-default overlay dir
# into the persisted XDG_CONFIG_HOME ($HOME/.config, bind-mounted to the
# instance data disk). User customizations made afterwards are preserved
# across container restart and instance stop/start: the default file is only
# copied when missing, never overwritten.
#
# Also seeds kscreenlockerrc (never auto-lock the headless streamed session)
#
# NOTE: the KSycoca services cache is rebuilt by start-desktop.sh BEFORE the
# session starts - task manager pins resolve through that cache and a stale
# cache renders pinned launchers as blank/broken icons.
#
# NOTE: do NOT pin launchers via the plasmashell scripting API
# (org.kde.PlasmaShell.evaluateScript writeConfig): it writes keys at the
# applet [Configuration] level while icontasks reads 'launchers' from
# [Configuration][General] - the pin lands in the wrong group and the task
# manager renders a single blank icon.
#

echo "Setting up default Plasma config..."

APPLETSRC_NAME=plasma-org.kde.plasma.desktop-appletsrc
APPLETSRC_DEFAULT=$CLOUDYPAD_CONF_DIR/plasma-default/$APPLETSRC_NAME
APPLETSRC=$XDG_CONFIG_HOME/$APPLETSRC_NAME

KSCREENLOCKERRC_DEFAULT=$CLOUDYPAD_CONF_DIR/kscreenlockerrc
KSCREENLOCKERRC=$XDG_CONFIG_HOME/kscreenlockerrc

# CLOUDYPAD_PLASMA_DEFAULT_FORCE=true forces re-seed over the persistent
# config - dev helper for fast feedback loops on the default overlay config
# (see ansible/inventories/dev-vagrant.yml debug mounts). Prod keeps the
# seed-once behavior to preserve user customizations.
SHOULD_RESEED=false
if [ "${CLOUDYPAD_PLASMA_DEFAULT_FORCE:-}" = "true" ] && [ -f "$APPLETSRC" ]; then
    echo "CLOUDYPAD_PLASMA_DEFAULT_FORCE=true: re-seeding default config over existing $APPLETSRC"
    SHOULD_RESEED=true
fi

if [ ! -f "$APPLETSRC" ] || [ "$SHOULD_RESEED" = "true" ]; then
    echo "Seeding Plasma config from $APPLETSRC_DEFAULT"
    mkdir -p "$(dirname "$APPLETSRC")"
    cp "$APPLETSRC_DEFAULT" "$APPLETSRC"
else
    echo "Plasma config already present at $APPLETSRC, keeping it (user customizations preserved)"
fi

# Seed screen locker config (disable auto-lock for the headless streamed
# session), only when missing so user customizations are preserved
if [ -f "$KSCREENLOCKERRC_DEFAULT" ] && [ ! -f "$KSCREENLOCKERRC" ]; then
    echo "Seeding kscreenlockerrc from $KSCREENLOCKERRC_DEFAULT"
    cp "$KSCREENLOCKERRC_DEFAULT" "$KSCREENLOCKERRC"
fi

echo "Plasma default config setup complete"