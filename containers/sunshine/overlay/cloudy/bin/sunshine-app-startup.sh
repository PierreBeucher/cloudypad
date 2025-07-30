#!/usr/bin/env bash

#
# Script run by Sunshine on session start
# to setup screen resolution and other session-dependent settings
#

# Export DBUS_SESSION_BUS_ADDRESS variable to be used by other scripts
source export-dbus-address.sh

# Setup screen resolution
setup-sunshine-screen-mode.sh

# Setup desktop icon size 
# Must be run after screen resolution is set
setup-xfce4-desktop-icon-size.sh