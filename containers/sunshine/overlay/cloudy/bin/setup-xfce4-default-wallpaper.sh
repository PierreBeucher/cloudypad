#!/usr/bin/env bash

#
# Setup default desktop wallpaper
#
# Wait for monitor configuration to appear in xfce4-desktop with 1 min timeout
# When it appears, setup the default desktop wallpaper

echo "Setting default Cloudy Pad desktop wallpaper..."

echo "Waiting for xfce4 monitor configuration to appear..."

TIMEOUT=60
ELAPSED=0
MONITOR_NAME=""

while [ $ELAPSED -lt $TIMEOUT ]; do
    XFCONF_QUERY_OUTPUT=$(xfconf-query -c xfce4-desktop -l 2>/dev/null)
    MONITOR_NAME=$(echo "$XFCONF_QUERY_OUTPUT" | grep "/backdrop/screen0/monitor" | head -1 | sed 's|/backdrop/screen0/\([^/]*\)/.*|\1|')
    
    if [ -n "$MONITOR_NAME" ]; then
        echo "Found monitor: $MONITOR_NAME after ${ELAPSED}s, setting xfce4 default desktop wallpaper..."
        
        # Set xfce4 default desktop wallpaper
        xfconf-query -c xfce4-desktop \
            -p /backdrop/screen0/${MONITOR_NAME}/workspace0/last-image \
            -s $XDG_CONFIG_HOME/xfce4-default/cloudypad-wallpaper.svg

        break
    fi
    
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if [ -z "$MONITOR_NAME" ]; then
    echo "Warning: Monitor configuration did not appear within ${TIMEOUT}s timeout. Desktop wallpaper not set."
    echo "Last xfconf-query output: "
    echo "$XFCONF_QUERY_OUTPUT"
fi