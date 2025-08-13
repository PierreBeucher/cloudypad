#!/usr/bin/env bash

# 
# Some NVIDIA drivers components are required in container
# to use Nvidia options of X server
# and ensure games are running on GPU
#
# Installed drivers must match those on host:
# DRIVER_TYPE and DRIVER_VERSION are passed as environment variables
#
# Use the .run install with a few options to keep only what's needed
#

set -e

NVIDIA_DATA_DIR=$CLOUDYPAD_DATA_DIR/nvidia/
mkdir -p $NVIDIA_DATA_DIR

if [ -z "${NVIDIA_DRIVER_VERSION}" ]; then
    echo "Error: NVIDIA_DRIVER_VERSION is not set. Set the NVIDIA_DRIVER_VERSION environment variable."
    exit 1
fi

if [ -z "${NVIDIA_DRIVER_TYPE}" ]; then
    echo "WARNING: NVIDIA_DRIVER_TYPE is not set. Using 'datacenter' as default."
    NVIDIA_DRIVER_TYPE="datacenter"
fi

NVIDIA_INSTALLER="$NVIDIA_DATA_DIR/nvidia-${NVIDIA_DRIVER_TYPE}-${NVIDIA_DRIVER_VERSION}.run"

# Create a marker file in XDG_RUNTIME_DIR to indicate that the driver is installed
# This is used to avoid reinstalling the driver on container restart
# But driver should be installed in freshly created container
NVIDIA_INSTALL_MARKER="$XDG_RUNTIME_DIR/nvidia-driver-${NVIDIA_DRIVER_TYPE}-${NVIDIA_DRIVER_VERSION}.installed"

echo "Checking Nvidia driver ${NVIDIA_DRIVER_VERSION} (${NVIDIA_DRIVER_TYPE}) component installation..."

# Check if the file already exists
if [ ! -f "$NVIDIA_INSTALLER" ]; then
    echo "NVIDIA driver version ${NVIDIA_DRIVER_VERSION} (type: '${NVIDIA_DRIVER_TYPE}') not found. Downloading..."
    
    echo "Removing old NVIDIA driver installers..."
    find "$NVIDIA_DATA_DIR" -type f -name "nvidia-*.run" -exec rm -f {} +
    find "$NVIDIA_DATA_DIR" -type f -name "nvidia-*.installed" -exec rm -f {} +

    # Select download URL based on driver type
    if [ "${NVIDIA_DRIVER_TYPE}" = "datacenter" ]; then
        DOWNLOAD_URL="https://us.download.nvidia.com/tesla/${NVIDIA_DRIVER_VERSION}/NVIDIA-Linux-x86_64-${NVIDIA_DRIVER_VERSION}.run"
    elif [ "${NVIDIA_DRIVER_TYPE}" = "display" ]; then
        DOWNLOAD_URL="https://download.nvidia.com/XFree86/Linux-x86_64/${NVIDIA_DRIVER_VERSION}/NVIDIA-Linux-x86_64-${NVIDIA_DRIVER_VERSION}.run"
    fi

    curl -fSL "$DOWNLOAD_URL" -o "$NVIDIA_INSTALLER"
    chmod +x "$NVIDIA_INSTALLER"

    echo "Downloaded $NVIDIA_INSTALLER"
else
    echo "NVIDIA driver installer file already exists: $NVIDIA_INSTALLER"
fi

# Check if the installation marker file exists
if [ -f "$NVIDIA_INSTALL_MARKER" ]; then
    echo "NVIDIA driver version ${NVIDIA_DRIVER_VERSION} is already installed. Skipping installation."
else 


    # Should take a few seconds since we skip most steps
    # Mostly needed for X nvidia modules
    # TODO maybe we can --skip --no more steps
    "$NVIDIA_INSTALLER" \
        --no-questions \
        --ui=none \
        --accept-license \
        --skip-depmod \
        --skip-module-unload \
        --no-kernel-modules \
        --no-kernel-module-source \
        --install-compat32-libs \
        --no-nouveau-check \
        --no-nvidia-modprobe \
        --no-systemd \
        --no-distro-scripts \
        --no-rpms \
        --no-backup \
        --no-check-for-alternate-installs \
        --no-libglx-indirect \
        --no-install-libglvnd

    touch "$NVIDIA_INSTALL_MARKER"
    echo "NVIDIA driver ${NVIDIA_DRIVER_VERSION} installed successfully."
fi