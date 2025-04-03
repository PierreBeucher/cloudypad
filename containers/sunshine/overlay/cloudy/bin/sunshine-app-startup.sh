#!/usr/bin/env bash

#
# Script run by Sunshine on session start
# to setup screen resolution and other session-dependent settings
#

# Setup screen resolution
setup-sunshine-screen-mode.sh

# Setup desktop icon size 
# Must be run after screen resolution is set
setup-xfce4-desktop-icon-size.sh
