#!/usr/bin/env bash

echo "Setting up pulseaudio..."

# Disable pulseaudio autospawn
# replace any existing value with autospawn = no

echo "Disabling pulseaudio autospawn..."
sed -i 's/^.*autospawn.*$/autospawn = no/' /etc/pulse/client.conf

echo "Pulseaudio setup done."
