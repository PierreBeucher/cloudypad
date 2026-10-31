#!/usr/bin/env bash

#
# Setup default Plasma desktop configuration (additive):
# - Seed the Plasma panel/task manager config (plasma-org.kde.plasma.desktop-appletsrc)
#   with Cloudy Pad defaults: task manager launchers pinned to Steam, Epic, GOG,
#   Heroic, Lutris, Firefox, Konsole, Files, Keyboard, Mouse, Help, Exit -
#   mirroring the former XFCE bottom dock
# - Seed plasmashellrc (60px panel = taskbar icon size)
#
# Look & feel (Breeze Dark theme) is NOT seeded here: on a fresh user config,
# Plasma session startup applies its own default look & feel AFTER this seed
# and overwrites theme files. The post-session applier
# (apply-plasma-default-lookandfeel.sh) is the only mechanism that wins - see
# its header for the full rationale.
#
# Config is seeded from the CLOUDYPAD_CONF_DIR/plasma-default overlay dir
# into the persisted XDG_CONFIG_HOME ($HOME/.config, bind-mounted to the
# instance data disk).
#
# Seeding rules:
# - Look & feel defaults (appletsrc, theme, panel size) apply to NEW instances
#   only: when XDG_CONFIG_HOME has never been used by a Plasma session, all
#   default files are seeded when missing. Existing instances keep whatever
#   they have: user customizations are never overridden.
# - Protective seeds (kscreenlockerrc: never auto-lock the headless streamed
#   session; baloofilerc: disable the file indexer) are seeded when missing on
#   any instance: they are functional safeguards, not preferences. Users who
#   customized them already have the file and are never overwritten.
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

PLASMA_DEFAULT_DIR=$CLOUDYPAD_CONF_DIR/plasma-default

APPLETSRC_NAME=plasma-org.kde.plasma.desktop-appletsrc
APPLETSRC_DEFAULT=$PLASMA_DEFAULT_DIR/$APPLETSRC_NAME
APPLETSRC=$XDG_CONFIG_HOME/$APPLETSRC_NAME

KSCREENLOCKERRC_DEFAULT=$PLASMA_DEFAULT_DIR/kscreenlockerrc
KSCREENLOCKERRC=$XDG_CONFIG_HOME/kscreenlockerrc

BALOOFILERC_DEFAULT=$PLASMA_DEFAULT_DIR/baloofilerc
BALOOFILERC=$XDG_CONFIG_HOME/baloofilerc

# A config dir already used by a Plasma session contains session-generated
# files (written at first session start, before any user customization).
# Their presence identifies an existing instance. Only files the session
# itself writes are valid markers: plasmashellrc must NOT be used, we seed
# it ourselves (a fresh instance interrupted before its first session would
# otherwise be misdetected as existing and never get the default look & feel).
IS_FRESH=true
for f in kactivitymanagerdrc kconf_updaterc plasma-localerc; do
    if [ -f "$XDG_CONFIG_HOME/$f" ]; then
        IS_FRESH=false
        echo "Existing Plasma user config detected ($f present): keeping existing config, look & feel defaults are only seeded on new instances"
        break
    fi
done

# Seed a look & feel default: new instances, when missing
seed_default() {
    local src=$1 dst=$2
    if [ "$IS_FRESH" != "true" ]; then
        return
    fi
    if [ ! -f "$src" ]; then
        echo "Warning: default $src not found, cannot seed $dst"
        return
    fi
    if [ -f "$dst" ]; then
        echo "$dst already present, keeping it (user customizations preserved)"
        return
    fi
    echo "Seeding $dst from $src"
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
}

# Seed a protective config: any instance, when missing
seed_protective() {
    local src=$1 dst=$2
    if [ ! -f "$src" ] || [ -f "$dst" ]; then
        return
    fi
    echo "Seeding $dst from $src"
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
}

# Look & feel defaults: new instances only
seed_default "$APPLETSRC_DEFAULT" "$APPLETSRC"
seed_default "$PLASMA_DEFAULT_DIR/plasmashellrc" "$XDG_CONFIG_HOME/plasmashellrc"

# Protective configs: any instance when missing
seed_protective "$KSCREENLOCKERRC_DEFAULT" "$KSCREENLOCKERRC"
seed_protective "$BALOOFILERC_DEFAULT" "$BALOOFILERC"

# Fresh config: Plasma session startup applies the default (light) look and
# feel over the seeded theme files. Flag the post-session applier
# (apply-plasma-default-lookandfeel.sh) to re-apply the Cloudy Pad default
# look & feel once the session is up. Flag lives in the ephemeral runtime dir:
# wiped on container restart, so this never runs on existing instances.
if [ "$IS_FRESH" = "true" ]; then
    mkdir -p "$XDG_RUNTIME_DIR"
    touch "$XDG_RUNTIME_DIR/cloudypad-apply-plasma-default-lookandfeel"
    echo "Default look & feel will be applied once the Plasma session is up"
fi

echo "Plasma default config setup complete"
