#!/bin/bash

set -euo pipefail

# Function to get latest digest for an image
get_latest_digest() {
    local image=$1
    docker buildx imagetools inspect "${image}" --raw | jq -r '.manifests[] | select(.platform.architecture == "amd64" and .platform.os == "linux") | .digest'
}

# Function to update the YAML file
update_yaml_file() {
    local yaml_file="ansible/roles/wolf/defaults/main.yml"
    local image_var=$1
    local new_image=$2
    
    echo "Updating ${image_var} in ${yaml_file} with ${new_image}..."
    
    # Use "!" delimiter to avoid issues with "/" in the image URL
    sed -i "s!^${image_var}.*!${image_var}: ${new_image}!" "$yaml_file"
    
    echo "Updated ${image_var} to ${new_image}"
}

# Main script
main() {
    echo "Starting Wolf images update..."
    
    # Define the images to update
    declare -A images=(
        ["wolf_server_image"]="ghcr.io/games-on-whales/wolf:stable"
        ["wolf_app_steam_image"]="ghcr.io/games-on-whales/steam:edge"
        ["wolf_app_lutris_image"]="ghcr.io/games-on-whales/lutris:edge"
        ["wolf_app_pegasus_image"]="ghcr.io/games-on-whales/pegasus:edge"
        ["wolf_app_retroarch_image"]="ghcr.io/games-on-whales/retroarch:edge"
        ["wolf_app_prismlauncher_image"]="ghcr.io/games-on-whales/prismlauncher:edge"
        ["wolf_app_firefox_image"]="ghcr.io/games-on-whales/firefox:edge"
    )
    
    # Update each image
    for var_name in "${!images[@]}"; do
        local image_url="${images[$var_name]}"
        
        echo "Processing $var_name ($image_url)..."
        
        # Get the latest digest
        local digest
        digest=$(get_latest_digest "$image_url")
        local new_image="${image_url}@${digest}"

        echo "Updating '${var_name}' with '${new_image}'..."

        update_yaml_file "$var_name" "$new_image"
        
        echo
    done
    
    echo "Wolf images update completed!"
}

# Run the main function
main "$@"