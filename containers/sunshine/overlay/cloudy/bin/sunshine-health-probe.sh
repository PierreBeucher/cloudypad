#!/usr/bin/env bash

#
# Probe Sunshine health by checking if the API is reachable
# If Sunshine is not healthy, automatically restart it via supervisorctl
# As Sunshine is known to sometime crash, this script makes Sunshine more resilient
#

HEALTHCHECK_SCRIPT="sunshine-healthcheck.sh"
SUPERVISORCTL_CMD="supervisorctl -c $XDG_CONFIG_HOME/supervisor/supervisord.conf"

MAX_RETRIES=3
RETRY_INTERVAL=10

echo "Starting Sunshine health probe..."

# Function to restart Sunshine
restart_sunshine() {
    echo "Restarting Sunshine process..."
    $SUPERVISORCTL_CMD restart sunshine
    if [ $? -eq 0 ]; then
        echo "Sunshine restart command sent successfully"
    else
        echo "Failed to restart Sunshine... Continuing."
    fi
}

# Main monitoring loop
main() {
    local retry_count=0
    
    echo "Starting Sunshine health monitoring (continuous mode)..."
    
    while true; do
        echo "Checking Sunshine health..."
        
        if "$HEALTHCHECK_SCRIPT"; then
            retry_count=0  # Reset retry count on successful health check
            sleep $RETRY_INTERVAL
        else
            echo "Sunshine is unhealthy: (attempt $((retry_count + 1))/$MAX_RETRIES)"
            retry_count=$((retry_count + 1))
            
            if [ $retry_count -ge $MAX_RETRIES ]; then
                echo "Sunshine failed health checks after $MAX_RETRIES attempts, restarting..."
                restart_sunshine
                
                # Wait for restart to take effect
                echo "Waiting 30s for Sunshine to start after restart..."
                sleep 30
                
                # Reset retry count after restart
                retry_count=0
                echo "Retry count reset, resuming monitoring..."
            else
                sleep $RETRY_INTERVAL
            fi
        fi
    done
}

# Start the main monitoring loop
main
