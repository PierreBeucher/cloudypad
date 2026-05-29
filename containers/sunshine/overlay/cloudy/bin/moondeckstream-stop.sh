#!/usr/bin/env bash

echo "Stopping MoonDeckStream..."

if [ ! -f /tmp/moondeckstream.pid ]; then
    echo "No MoonDeckStream PID found at /tmp/moondeckstream.pid... Not stopping."
    exit 0
fi

MOONDECKSTREAM_PID=$(cat /tmp/moondeckstream.pid)

echo "Killing MoonDeckStream with PID: $MOONDECKSTREAM_PID"

# Kill MoonDeckStream processes
kill $MOONDECKSTREAM_PID

echo "MoonDeckStream stopped"
