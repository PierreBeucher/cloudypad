#!/usr/bin/env bash

echo "Stopping Prism Launcher..."

if [ ! -f /tmp/prismlauncher.pid ]; then
    echo "No Prism Launcher PID found at /tmp/prismlauncher.pid... Not stopping."
    exit 0
fi

PRISMLAUNCHER_PID=$(cat /tmp/prismlauncher.pid)

echo "Killing Prism Launcher with PID: $PRISMLAUNCHER_PID"

kill $PRISMLAUNCHER_PID

echo "Prism Launcher stopped"
