#!/usr/bin/env bash

echo "Stopping Lutris..."

if [ ! -f /tmp/lutris.pid ]; then
    echo "No Lutris PID found at /tmp/lutris.pid... Not stopping."
    exit 0
fi

LUTRIS_PID=$(cat /tmp/lutris.pid)

echo "Killing Lutris with PID: $LUTRIS_PID"

# Kill Lutris processes
kill $LUTRIS_PID

echo "Lutris stopped"