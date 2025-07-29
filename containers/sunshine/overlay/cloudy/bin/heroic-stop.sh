#!/usr/bin/env bash

echo "Stopping Heroic Games Launcher..."

if [ ! -f /tmp/heroic.pid ]; then
    echo "No Heroic Games Launcher PID found at /tmp/heroic.pid... Not stopping."
    exit 0
fi

HEROIC_PID=$(cat /tmp/heroic.pid)

echo "Killing Heroic Games Launcher with PID: $HEROIC_PID"

# Kill Heroic Games Launcher processes
kill $HEROIC_PID

echo "Heroic Games Launcher stopped"