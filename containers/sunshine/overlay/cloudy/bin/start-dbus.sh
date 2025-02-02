#!/usr/bin/env bash

dbus-daemon --nofork --nopidfile --nosyslog --system --address="${DBUS_SYSTEM_BUS_ADDRESS}"