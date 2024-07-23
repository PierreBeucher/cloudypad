#!/usr/bin/env bash

# Prepare Docker volume for Wolf - See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
# Not practical as plain Ansible tasks, using a good old shell script is easier and more maintainable
# Script fixes statically as most versions as possible to provide strong reproducibility guarantees

set -e

NVIDIA_DRIVER_DOCKERFILE_GIT_REF=afca1a10b3816f34c51163972cce46be0489e589
NVIDIA_VERSION_FILE="/sys/module/nvidia/version"

CURRENT_NVIDIA_VERSION=$(cat $NVIDIA_VERSION_FILE)
NVIDIA_DRIVER_VOLUME_NAME=nvidia-driver-vol-$CURRENT_NVIDIA_VERSION

# Skip if volume for version already exists
if docker volume ls -q --filter name=$NVIDIA_DRIVER_VOLUME_NAME | grep -q $NVIDIA_DRIVER_VOLUME_NAME; then
  echo "Docker volume '$NVIDIA_DRIVER_VOLUME_NAME' already exists. Skipping NVIDIA driver image build..."
  exit 0
fi

echo "Building NVIDIA driver image for version $CURRENT_NVIDIA_VERSION"

NVIDIA_DRIVER_IMAGE_NAME="gow/nvidia-driver:$CURRENT_NVIDIA_VERSION"
curl https://raw.githubusercontent.com/games-on-whales/gow/$NVIDIA_DRIVER_DOCKERFILE_GIT_REF/images/nvidia-driver/Dockerfile | \
    docker build -t $NVIDIA_DRIVER_IMAGE_NAME -f - --build-arg NV_VERSION=$CURRENT_NVIDIA_VERSION /tmp


echo "Creating NVIDIA driver volume for version $CURRENT_NVIDIA_VERSION"

# Create a dummy container to create and populate volume if not already exists
# If volume already exists this won't have any effect
docker create --rm --mount source=$NVIDIA_DRIVER_VOLUME_NAME,destination=/usr/nvidia $NVIDIA_DRIVER_IMAGE_NAME sh

# TODO cleanup image for space effiency: as long as Volume exists we're good to go

# # Check if the nvidia-drm module's modeset parameter is set to Y
# if [[ $(cat /sys/module/nvidia_drm/parameters/modeset) != "Y" ]]; then
#     echo "The nvidia-drm module's modeset parameter is not set to Y."
#     echo "See https://games-on-whales.github.io/wolf/stable/user/quickstart.html for expected setup."
#     exit 2
# fi