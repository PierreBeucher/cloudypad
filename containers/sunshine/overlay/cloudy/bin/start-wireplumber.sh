#!/usr/bin/env bash

set -e

# Connect to session bus if available (required by RTKit module, wireplumber exits without it)
source export-dbus-address.sh || true

echo "Starting WirePlumber (PipeWire session manager)..."

exec wireplumber
