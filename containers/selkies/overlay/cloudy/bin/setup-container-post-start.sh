#!/usr/bin/env bash

set -e

#
# Container post-start setup script
#
# Designed to run at container start, after all services are started
# to setup a few things aynchronously without impacting overall startup time
#

# Update apt cache on startup.
# This is necessary otherwise Steam will show an error on startup like "package out of date"
# and will try to apt update but would fail since it's not run as root.
# This doesn't prevent Steam to start and work, and seems ot only appear when
# apt cache is non-existent (as is the case after Docker build).
# Updating cache seems to solve the issue
apt update

# Setup sudo config for cloudypad user with random password
setup-sudo.sh