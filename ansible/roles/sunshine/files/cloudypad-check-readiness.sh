#!/usr/bin/env bash

# Check Sunshine readiness by it's container healthiness
echo "Checking Sunshine readiness..."

# Check if Sunshine container is healthy
sunshine_health=$(docker inspect -f '{{.State.Health.Status}}' cloudy)

echo "Sunshine container health status: '$sunshine_health'"

# If Sunshine container is not healthy, exit with error
if [[ $sunshine_health != "healthy" ]]; then
    echo "Sunshine is not ready"
    exit 1
else
    echo "Sunshine is ready"
    exit 0
fi