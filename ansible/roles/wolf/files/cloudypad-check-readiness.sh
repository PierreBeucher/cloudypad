#!/usr/bin/env bash

# Check Wolf readiness by checking if port 47990 (HTTP interface) is open
echo "Checking Wolf readiness..."

# Check Wolf HTTP port
nc -v -z localhost 47989
wolf_health=$?

# Check if Wolf container is healthy
echo "Wolf server connection check: '$wolf_health'"

# If Wolf container is not healthy, exit with error
if [[ $wolf_health != 0 ]]; then
    echo "Wolf is not ready"
    exit 1
else
    echo "Wolf is ready"
    exit 0
fi