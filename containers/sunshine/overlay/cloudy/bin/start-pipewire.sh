#!/usr/bin/env bash

set -e

# Connect to session bus if available (used by RTKit module)
source export-dbus-address.sh || true

echo "Starting PipeWire..."

exec pipewire
