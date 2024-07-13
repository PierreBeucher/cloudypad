#!/usr/bin/env bash

# Wrapper around CloudyPad container in which most operations are performed 
# so that no other dependency other than Docker or a container runtime is needed
#
# Build a container image with current user ID on the fly (to avoid permission issues)
# and run instructions.
# Only a few commands need to run directly for user (eg. moonlight setup)

set -e

# TODO fix on release
CLOUDYPAD_IMAGE="cloudypad:local"
CLOUDYPAD_TARGET_IMAGE="cloudypad-run:local"

# Build Dockerfile on-the-fly
cat <<EOF > /tmp/Dockerfile-cloudypad-run
FROM $CLOUDYPAD_IMAGE

RUN useradd -u $(id -u) --home-dir $HOME --create-home $(whoami)

USER myuser
EOF

# Build the Docker image
docker build -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run > /dev/null

run_cloudypad_docker() {

    docker run --rm -it \
        -v $HOME/.ssh:$HOME/.ssh \
        -v $HOME/.aws:$HOME/.aws:ro \
        -v $HOME/.cloudypad:$HOME/.cloudypad \
        -v $HOME/.paperspace:$HOME/.paperspace \
        -u "$(id -u)" \
        $CLOUDYPAD_TARGET_IMAGE \
        "$@"
}

run_cloudypad_docker "${@:1}"