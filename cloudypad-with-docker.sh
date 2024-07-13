#!/usr/bin/env bash

# CloudyPad run in a Docker container
# Make sure we have a user matching current user's UID in container to prevent permission issue
# Then run container

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
    -v $HOME/.ssh:$HOME/.ssh:ro \
    -v $HOME/.aws:$HOME/.aws:ro \
    -v $HOME/.cloudypad:$HOME/.cloudypad \
    -v $HOME/.paperspace:$HOME/.paperspace \
    -u "$(id -u)" \
    $CLOUDYPAD_TARGET_IMAGE \
    "$@"
}

run_cloudypad_docker "${@:1}"