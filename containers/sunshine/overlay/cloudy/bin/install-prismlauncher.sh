#!/usr/bin/env bash

#
# Installation script for Prism Launcher (Minecraft)
#

set -e

PRISMLAUNCHER_VERSION="${PRISMLAUNCHER_VERSION:-10.0.2}"
PRISMLAUNCHER_APP_DIR="/opt/prismlauncher"
PRISMLAUNCHER_APPIMAGE_URL="https://github.com/PrismLauncher/PrismLauncher/releases/download/${PRISMLAUNCHER_VERSION}/PrismLauncher-Linux-x86_64.AppImage"

echo "Installing Prism Launcher ${PRISMLAUNCHER_VERSION}..."

# Check if already installed
if [ -x "${PRISMLAUNCHER_APP_DIR}/PrismLauncher.AppImage" ]; then
    echo "Prism Launcher is already installed at ${PRISMLAUNCHER_APP_DIR}"
    echo "To reinstall, remove the directory first: sudo rm -rf ${PRISMLAUNCHER_APP_DIR}"
    exit 0
fi

# Install dependencies
echo "Installing dependencies..."
sudo apt-get update
sudo apt-get install -y fuse3 libfuse2t64 openjdk-21-jre

# Download AppImage
echo "Downloading Prism Launcher AppImage..."
cd /tmp
curl -L -o PrismLauncher.AppImage "${PRISMLAUNCHER_APPIMAGE_URL}"

# Install AppImage
echo "Installing AppImage..."
sudo install -d -o "${CLOUDYPAD_USER}" -g "${CLOUDYPAD_USER}" "${PRISMLAUNCHER_APP_DIR}"
sudo install -m 0755 -o "${CLOUDYPAD_USER}" -g "${CLOUDYPAD_USER}" PrismLauncher.AppImage "${PRISMLAUNCHER_APP_DIR}/PrismLauncher.AppImage"
sudo ln -sf "${PRISMLAUNCHER_APP_DIR}/PrismLauncher.AppImage" /usr/local/bin/prismlauncher
rm PrismLauncher.AppImage

# Add to Sunshine apps.json
APPS_JSON="${XDG_CONFIG_HOME}/sunshine/apps.json"
if [ -f "$APPS_JSON" ] && ! grep -q "Prism Launcher" "$APPS_JSON"; then
    echo "Adding Prism Launcher to Sunshine apps..."
    sed -i 's/        }$/        },/' "$APPS_JSON"
    sed -i '/^    ]$/i\        {\
            "name": "Prism Launcher (Minecraft)",\
            "image-path": "$(XDG_CONFIG_HOME)/sunshine/assets/prismlauncher.png",\
            "prep-cmd": [\
                {\
                    "do": "sh -c \\"sunshine-app-startup.sh > /tmp/sunshine-session-start.log 2>\&1\\"",\
                    "undo": "sh -c \\"prismlauncher-stop.sh > /tmp/prismlauncher-stop.log 2>\&1\\""\
                }\
            ],\
            "detached": [\
                "sh -c \\"prismlauncher-start.sh > /tmp/prismlauncher-start.log 2>\&1\\""\
            ],\
            "exclude-global-prep-cmd": "false",\
            "auto-detach": "true",\
            "wait-all": "true",\
            "exit-timeout": "5",\
            "cmd": ""\
        }' "$APPS_JSON"
fi

echo ""
echo "Prism Launcher installed successfully!"
echo ""
