#!/usr/bin/env bash

#
# udev daemon daemon is required to handle virtual devices with /dev/uinput
#

/lib/systemd/systemd-udevd

# TODO Maybe start udevadm monitor as well to get some logs 