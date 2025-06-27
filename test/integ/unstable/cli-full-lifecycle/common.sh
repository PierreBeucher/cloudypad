#!/usr/bin/env bash


set -e

# Build local image to run tests
export CLOUDYPAD_IMAGE="ghcr.io/gabbelitov2/cloudypad:local"
# export CLOUDYPAD_CLI_LAUNCHER_DEBUG=true

# Use container image or local script directly
# Faster with local script but may miss container image issue

# task build-core-container-local > /dev/null && cloudypad_cmd="./cloudypad.sh"
cloudypad_cmd="npx tsx src/cli/main.ts" # TODO

# Verify instance status after deployment
# Use a retry pattern to wait for readiness
function check_instance_status() {
    local instance_name=$1
    local retries=12
    local wait_time=10

    echo "Checking instance status for $instance_name"

    for ((i=1; i<=retries; i++)); do
        get_instance_result=$($cloudypad_cmd get $instance_name)

        echo "Got instance: $get_instance_result"
        
        instance_status=$(echo $get_instance_result | jq -r '.status.serverStatus')
        instance_provisioned=$(echo $get_instance_result | jq -r '.status.provisioned')
        instance_configured=$(echo $get_instance_result | jq -r '.status.configured')
        instance_ready=$(echo $get_instance_result | jq -r '.status.ready')

        if [ "$instance_status" == "running" ] && [ "$instance_provisioned" == "true" ] && [ "$instance_configured" == "true" ] && [ "$instance_ready" == "true" ]; then
            echo "Instance is running and ready"
            return 0
        fi

        echo "($(date +%Y-%m-%d-%H-%M-%S)) Instance is not ready yet, retrying in $wait_time seconds (retry $i/$retries)..."
        sleep $wait_time
    done

    echo "Instance is not ready after $retries attempts, exiting..."
    exit 1
}
