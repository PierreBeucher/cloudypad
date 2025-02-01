#!/usr/bin/env bash

set -e

# Setup directories and configs for current runtime environment
setup-all.sh

# Start all services: X server, Sunshine, etc.
exec /usr/bin/supervisord --nodaemon --user root -c /cloudy/conf/supervisor/supervisord.conf