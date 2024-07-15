#!/usr/bin/env bash

# Wrapper around CloudyPad container in which most operations are performed 
# so that no other dependency other than Docker or a container runtime is needed
#
# Build a container image with current user ID on the fly (to avoid permission issues)
# and run instructions.
# Only a few commands need to run directly for user (eg. moonlight setup)

set -e

CLOUDYPAD_IMAGE="${CLOUDYPAD_IMAGE:-"crafteo/cloudypad:0.0.1"}"
CLOUDYPAD_TARGET_IMAGE="crafteo/cloudypad-local-runner:local"

if ! docker image inspect $CLOUDYPAD_IMAGE > /dev/null 2>&1; then
    echo "Please wait a moment while Cloudy Pad container image $CLOUDYPAD_IMAGE is being pulled... (This is a one time action)" >&2
    docker pull $CLOUDYPAD_IMAGE >&2
fi

# Build Dockerfile on-the-fly
# make sure the container's user ID and group match host to prevent permission issue
cat <<EOF > /tmp/Dockerfile-cloudypad-run
FROM $CLOUDYPAD_IMAGE

# Check if main group exists, create if not
RUN if ! getent group $(id -gn) >/dev/null; then \
    groupadd -g $(id -g) $(id -gn); \
fi

# Check if user exists, create if not
RUN if ! id -u $(whoami) >/dev/null 2>&1; then \
    useradd -u $(id -u) -g $(id -g) --home-dir $HOME --create-home $(whoami); \
fi

USER $(whoami)
EOF

container_build_output=$(docker build --progress plain -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run 2>&1)
container_build_result=$?

if [ $container_build_result -ne 0 ]; then
    echo "Error: could not build CloudyPad container image, build exited with code: $container_build_result" >&2
    echo "Build command was: docker build --progress plain -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run 2>&1" >&2
    echo "Build output: "
    echo "$container_build_output"
    echo
    echo "If you think this is a bug, please file an issue." >&2
    exit 1
fi

run_cloudypad_docker() {

    # Ensure this directory exists to be mounted in container
    # And not create it from Docker volume mount as root
    mkdir -p $HOME/.cloudypad

    # Create Paperspace and directory if not already exists to keep it if user log-in from containr
    mkdir -p $HOME/.paperspace

    # List of directories to mount only if they exist
    local mounts=(
        "$HOME/.ssh"
        "$HOME/.aws"
        "$HOME/.cloudypad"
        "$HOME/.paperspace"
    )

    # Build run command with proper directories
    local cmd="docker run --rm -it"

    for mount in "${mounts[@]}"; do
        if [ -d "$mount" ]; then
            cmd+=" -v $mount:$mount"
        fi
    done

    # Add SSH agent volume and env var if it's installed locally
    if [ -n "$SSH_AUTH_SOCK" ]; then
        cmd+=" -v $SSH_AUTH_SOCK:/ssh-agent -e SSH_AUTH_SOCK=/ssh-agent"
    fi

    cmd+="  $CLOUDYPAD_TARGET_IMAGE $@"

    $cmd
}

run_cloudypad_docker "${@:1}"