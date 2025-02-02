#!/usr/bin/env bash

# Only the following extensions can be run-time enabled/disabled:
# Generic Event Extension
# MIT-SHM
# XTEST
# SECURITY
# XINERAMA
# XFIXES
# RENDER
# RANDR
# COMPOSITE
# DAMAGE
# MIT-SCREEN-SAVER
# DOUBLE-BUFFER
# RECORD
# DPMS
# X-Resource
# XVideo
# XVideo-MotionCompensation
# SELinux
# GLX

wait-udev-availability.sh

# Why both -ext XINERAMA and -xinerama
/usr/bin/Xorg :42 \
    -ac \
    -noreset \
    -novtswitch \
    +extension RANDR \
    +extension RENDER \
    +extension GLX \
    +extension XVideo \
    +extension DOUBLE-BUFFER \
    +extension SECURITY \
    +extension DAMAGE \
    +extension X-Resource \
    -extension XINERAMA -xinerama \
    +extension Composite \
    +extension COMPOSITE \
    -s off \
    -nolisten tcp \
    -verbose