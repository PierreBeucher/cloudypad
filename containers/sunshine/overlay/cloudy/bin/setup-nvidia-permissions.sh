#!/usr/bin/env bash

#
# Setup NVIDIA device permissions.
# 

# NVIDIA Container Toolkit 1.18+ defaults to JIT CDI mode and no longer applies
# its CDI chmod hook by default. Keep GPU display devices usable by the
# unprivileged cloudy user when devices are mounted with host permissions.
echo "Setting NVIDIA device permissions for /dev/dri/card*, /dev/dri/renderD* and /dev/nvidia-modeset"

chmod 0666 /dev/dri/card* /dev/dri/renderD* /dev/nvidia-modeset || true
