#!/usr/bin/env bash

wait-x-availability.sh

source export-dbus-address.sh

/usr/games/lutris &

LUTRIS_PID=$!
echo $LUTRIS_PID > /tmp/lutris.pid
echo "Lutris started with PID: $LUTRIS_PID"

wait $LUTRIS_PID