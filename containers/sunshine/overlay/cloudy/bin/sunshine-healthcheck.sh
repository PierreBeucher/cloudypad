#!/usr/bin/env bash

#
# Check Sunshine health by checking if the API is reachable
#

sunshine_healthcheck_url="https://localhost:47990/api/configLocale"

echo "Checking Sunshine health using $sunshine_healthcheck_url..."

sunshine_response=$(curl -k -s -o /dev/null -w "%{http_code}" $sunshine_healthcheck_url)

if [[ $sunshine_response -eq 200 ]]; then
    echo "Sunshine is healthy"
    exit 0
else
    echo "Sunshine is unhealthy"
    exit 1
fi
