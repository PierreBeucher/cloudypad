#!/usr/bin/env bash

#
# Setup default Plasma desktop appearance (additive only):
# - Cloudy Pad wallpaper on all desktops
# - Pin Cloudy Pad app launchers (Steam, Epic, GOG, Heroic, Lutris, Firefox,
#   Terminal, Files, Keyboard, Mouse, Help, Exit) to the task manager,
#   mirroring the former XFCE bottom dock
#
# Uses the plasmashell scripting API (org.kde.PlasmaShell.evaluateScript):
# changes apply live and are persisted by plasmashell in its config. User
# customizations done afterwards are preserved (script runs on every start
# and would re-apply; a future improvement could apply only once).
#

echo "Setting up default Plasma desktop..."

# Wait for plasmashell to register on DBus (max 120s)
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if qdbus org.kde.plasmashell /PlasmaShell >/dev/null 2>&1; then
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if ! qdbus org.kde.plasmashell /PlasmaShell >/dev/null 2>&1; then
    echo "Warning: plasmashell did not register on DBus within ${TIMEOUT}s. Plasma defaults not applied."
    exit 0
fi

echo "plasmashell available after ${ELAPSED}s, applying Plasma desktop defaults..."

# Cloudy Pad wallpaper on all desktops
qdbus org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "
var desktops = desktops();
for (var i = 0; i < desktops.length; i++) {
    desktops[i].wallpaperPlugin = 'org.kde.image';
    desktops[i].currentConfigGroup = ['Wallpaper', 'org.kde.image', 'General'];
    desktops[i].writeConfig('Image', 'file:///usr/share/wallpapers/cloudypad-wallpaper.svg');
}"

echo "Wallpaper applied: /usr/share/wallpapers/cloudypad-wallpaper.svg"

# Pin app launchers to the task manager (icon-only task manager)
# Order mirrors the former XFCE bottom dock
qdbus org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "
var panels = panels();
for (var i = 0; i < panels.length; i++) {
    var widgets = panels[i].widgets();
    for (var j = 0; j < widgets.length; j++) {
        if (widgets[j].type == 'org.kde.plasma.icontasks') {
            widgets[j].writeConfig('launchers', [
                'applications:cloudypad-steam.desktop',
                'applications:cloudypad-epic.desktop',
                'applications:cloudypad-gog.desktop',
                'applications:cloudypad-heroic.desktop',
                'applications:cloudypad-lutris.desktop',
                'applications:firefox.desktop',
                'applications:org.kde.konsole.desktop',
                'applications:cloudypad-files.desktop',
                'applications:cloudypad-keyboard.desktop',
                'applications:cloudypad-mouse.desktop',
                'applications:cloudypad-help.desktop',
                'applications:cloudypad-exit.desktop'
            ].join(','));
        }
    }
}"

echo "Task manager launchers pinned"

echo "Plasma desktop defaults applied"
