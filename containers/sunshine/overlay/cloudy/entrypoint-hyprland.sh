#!/usr/bin/env bash

set -e

# Setup directories and configs for current runtime environment
source setup-all-hyprland.sh

# Start all services: Hyprland, PipeWire, Sunshine, etc.
exec /usr/bin/supervisord --nodaemon --user root -c /cloudy/conf/supervisor/supervisord-hyprland.conf
