#!/usr/bin/env bash

#
# Installation script for Prism Launcher (Minecraft)
#

set -e

PRISMLAUNCHER_VERSION="${PRISMLAUNCHER_VERSION:-10.0.2}"
PRISMLAUNCHER_APP_DIR="/opt/prismlauncher"
PRISMLAUNCHER_APPIMAGE_URL="https://github.com/PrismLauncher/PrismLauncher/releases/download/${PRISMLAUNCHER_VERSION}/PrismLauncher-Linux-x86_64.AppImage"

is_installed() {
    [ -x "${PRISMLAUNCHER_APP_DIR}/PrismLauncher.AppImage" ]
}

add_to_sunshine_apps() {
    APPS_JSON="${XDG_CONFIG_HOME}/sunshine/apps.json"
    
    [ ! -f "$APPS_JSON" ] && return
    
    # Check if already added
    if jq -e '.apps[] | select(.name | contains("Prism Launcher"))' "$APPS_JSON" > /dev/null 2>&1; then
        return
    fi
    
    # Add new app
    jq '.apps += [{
        "name": "Prism Launcher (Minecraft)",
        "image-path": "$(XDG_CONFIG_HOME)/sunshine/assets/prismlauncher.png",
        "prep-cmd": [{
            "do": "sh -c \"sunshine-app-startup.sh > /tmp/sunshine-session-start.log 2>&1\"",
            "undo": "sh -c \"prismlauncher-stop.sh > /tmp/prismlauncher-stop.log 2>&1\""
        }],
        "detached": ["sh -c \"prismlauncher-start.sh > /tmp/prismlauncher-start.log 2>&1\""],
        "exclude-global-prep-cmd": "false",
        "auto-detach": "true",
        "wait-all": "true",
        "exit-timeout": "5",
        "cmd": ""
    }]' "$APPS_JSON" > "${APPS_JSON}.tmp" && mv "${APPS_JSON}.tmp" "$APPS_JSON"
}

if is_installed; then
    echo "Already installed"
    exit 0
fi

echo "10"; echo "# Installing dependencies..."
sudo apt-get update > /tmp/prismlauncher-install.log 2>&1

echo "30"; echo "# Installing Java and fuse..."
sudo apt-get install -y fuse3 libfuse2t64 openjdk-21-jre >> /tmp/prismlauncher-install.log 2>&1

echo "50"; echo "# Downloading Prism Launcher..."
curl -L -o /tmp/PrismLauncher.AppImage "${PRISMLAUNCHER_APPIMAGE_URL}" >> /tmp/prismlauncher-install.log 2>&1

echo "70"; echo "# Installing Prism Launcher..."
sudo install -d -o "${CLOUDYPAD_USER}" -g "${CLOUDYPAD_USER}" "${PRISMLAUNCHER_APP_DIR}"
sudo install -m 0755 -o "${CLOUDYPAD_USER}" -g "${CLOUDYPAD_USER}" /tmp/PrismLauncher.AppImage "${PRISMLAUNCHER_APP_DIR}/PrismLauncher.AppImage"
sudo ln -sf "${PRISMLAUNCHER_APP_DIR}/PrismLauncher.AppImage" /usr/local/bin/prismlauncher
rm -f /tmp/PrismLauncher.AppImage

echo "90"; echo "# Adding to Sunshine apps..."
add_to_sunshine_apps

echo "100"; echo "# Done!"
