#!/usr/bin/env bash

#
# Setup default Plasma desktop configuration (additive):
# - Seed the Plasma panel/task manager config (plasma-org.kde.plasma.desktop-appletsrc)
#   with Cloudy Pad defaults: task manager launchers pinned to Steam, Epic, GOG,
#   Heroic, Lutris, Firefox, Konsole, Files, Keyboard, Mouse, Help, Exit -
#   mirroring the former XFCE bottom dock
#
# Config is seeded from conf/plasma-default overlay dir into the persistent
# XDG_CONFIG_HOME (/cloudy/conf). User customizations made afterwards are
# preserved on restart: the default file is only copied when missing, never
# overwritten (same pattern as the former setup-xfce4-default-config.sh).
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
APPLETSRC_DEFAULT=$XDG_CONFIG_HOME/plasma-default/$APPLETSRC_NAME
APPLETSRC=$XDG_CONFIG_HOME/$APPLETSRC_NAME

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

echo "Plasma default config setup complete"