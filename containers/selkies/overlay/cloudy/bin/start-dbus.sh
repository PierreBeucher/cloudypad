#!/usr/bin/env bash

echo "Starting dbus-daemon..."

dbus-daemon --nofork --nopidfile --nosyslog --system --address="${DBUS_SYSTEM_BUS_ADDRESS}"