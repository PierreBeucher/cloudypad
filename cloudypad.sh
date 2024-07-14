#!/usr/bin/env bash

# Wrapper around CloudyPad container in which most operations are performed 
# so that no other dependency other than Docker or a container runtime is needed
#
# Build a container image with current user ID on the fly (to avoid permission issues)
# and run instructions.
# Only a few commands need to run directly for user (eg. moonlight setup)

# TODO fix on release
CLOUDYPAD_IMAGE="cloudypad:local"
CLOUDYPAD_TARGET_IMAGE="cloudypad-run:local"

# Build Dockerfile on-the-fly
cat <<EOF > /tmp/Dockerfile-cloudypad-run
FROM $CLOUDYPAD_IMAGE

RUN useradd -u $(id -u) --home-dir $HOME --create-home $(whoami)

USER $(whoami)
EOF

container_build_output=$(docker build --progress plain -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run 2>&1)
container_build_result=$?

if [ $container_build_result -ne 0 ]; then
    echo "Error: could not build CloudyPad container image, build exited with code: $container_build_result" >&2
    echo "Build command was: docker build --progress plain -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run 2>&1" >&2
    echo "If you think this is a bug, please file an issue." >&2
    exit 1
fi

run_cloudypad_docker() {

    # List of directories to mount only if they exist
    local mounts=(
        "$HOME/.ssh"
        "$HOME/.aws:ro"
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

    cmd+="  $CLOUDYPAD_TARGET_IMAGE $@"

    $cmd
}

run_cloudypad_docker "${@:1}"