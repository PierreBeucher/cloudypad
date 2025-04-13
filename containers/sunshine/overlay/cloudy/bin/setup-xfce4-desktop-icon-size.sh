#!/usr/bin/env bash

#
# Set xfce4 desktop bottom dock icon size depending on screen resolution
#

# Get current screen resolution in format WIDTHxHEIGHT
# xrandr would output something like "DUMMY0 connected primary 1920x1080+0+0 0mm x 0mm", only extract first connect screen resolution with regex
current_screen_resolution=$(xrandr -q | grep -w "connected" | grep -oP '\d+x\d+' | head -n1)

# extract WIDTH and HEIGHT from WIDTHxHEIGHT (eg. 1920x1080)
current_screen_width=$(echo $current_screen_resolution | cut -dx -f1)
current_screen_height=$(echo $current_screen_resolution | cut -dx -f2)

# Set icon size to 10% screen height
icon_size=$(($current_screen_height / 10))

echo "Setting desktop icon size to $icon_size for resolution: $current_screen_resolution (width: $current_screen_width, height: $current_screen_height)"

if [ -f "$XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address" ]; then
    export DBUS_SESSION_BUS_ADDRESS=$(cat $XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address)
    xfconf-query -c xfce4-panel -p /panels/panel-2/size -s $icon_size
else
    echo "WARNING: $XDG_RUNTIME_DIR/xfce4-dbus-session-bus-address does not exist. Can't set desktop icon size."
fi
