#!/usr/bin/env bash

wait-x-availability.sh

# Copy desktop entry to user's desktop and ensure they are executable
mkdir -p $HOME/Desktop/
cp $XDG_CONFIG_HOME/desktop-apps/* $HOME/Desktop/

for f in $HOME/Desktop/*.desktop; do
    chmod +x "$f"

    # Must be trusted to be run by user
    # See https://stackoverflow.com/questions/51747456/is-it-possible-to-modify-gnome-desktop-file-metadata-from-non-gui-session-using
    # and https://forum.xfce.org/viewtopic.php?pid=70661#p70661
    dbus-launch gio set -t string "$f" "metadata::trusted" yes
    dbus-launch gio set -t string "$f" "metadata::xfce-exe-checksum" "$(sha256sum $f | awk '{print $1}')"
done

# Shows a bunch of warning but at least doesn't crash ¯\_(ツ)_/¯
startxfce4