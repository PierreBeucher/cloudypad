#!/usr/bin/env bash

set -e

echo "===================="
echo "Testing Ubuntu"

docker build -f test/shell/Dockerfile.ubuntu -t cloudypad-test-cli-ubuntu:local .
docker run \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    cloudypad-test-cli-ubuntu:local \
    ./cloudypad.sh --version

echo "===================="
echo "Testing Debian"

docker build -f test/shell/Dockerfile.debian -t cloudypad-test-cli-debian:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    cloudypad-test-cli-debian:local \
    bash -c './cloudypad.sh --version'

echo "===================="
echo "Testing Alpine"

docker build -f test/shell/Dockerfile.alpine -t cloudypad-test-cli-alpine:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    cloudypad-test-cli-alpine:local \
    bash -c './cloudypad.sh --version'