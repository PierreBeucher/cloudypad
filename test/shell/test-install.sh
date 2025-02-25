#!/usr/bin/env bash

set -e

echo "Testing Ubuntu with bash"

docker build -f test/shell/Dockerfile.ubuntu -t cloudypad-test-install-ubuntu:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    -e CLOUDYPAD_ANALYTICS_DISABLE="true" \
    cloudypad-test-install-ubuntu:local \
    bash -e -i -c 'cat /cloudypad/install.sh | bash && source /root/.bashrc && echo $PATH && which cloudypad || (echo "Cloudypad not found on PATH after install" && false)'

echo "===================="
echo "Testing Ubuntu with sh"

docker build -f test/shell/Dockerfile.ubuntu -t cloudypad-test-install-ubuntu:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    -e CLOUDYPAD_ANALYTICS_DISABLE="true" \
    cloudypad-test-install-ubuntu:local \
    sh -c 'cat /cloudypad/install.sh | sh && PATH=$PATH:/root/.cloudypad/bin && echo $PATH && which cloudypad || (echo "Cloudypad not found on PATH after install" && false)'

echo "===================="
echo "Testing Ubuntu with zsh"

docker build -f test/shell/Dockerfile.ubuntu -t cloudypad-test-install-ubuntu:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    -e CLOUDYPAD_ANALYTICS_DISABLE="true" \
    cloudypad-test-install-ubuntu:local \
    zsh -c 'cat /cloudypad/install.sh | zsh && PATH=$PATH:/root/.cloudypad/bin && echo $PATH && which cloudypad || (echo "Cloudypad not found on PATH after install" && false)'

echo "===================="
echo "Testing Debian with bash"

docker build -f test/shell/Dockerfile.debian -t cloudypad-test-install-debian:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    -e CLOUDYPAD_ANALYTICS_DISABLE="true" \
    cloudypad-test-install-debian:local \
    bash -i -c 'cat /cloudypad/install.sh | bash && source /root/.bashrc && echo $PATH && which cloudypad || (echo "Cloudypad not found on PATH after install" && false)'

echo "===================="
echo "Testing Alpine with sh"


docker build -f test/shell/Dockerfile.alpine -t cloudypad-test-install-alpine:local .
docker run -i \
    -v $PWD:/cloudypad -w /cloudypad \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e CLOUDYPAD_CONTAINER_NO_TTY="true" \
    -e CLOUDYPAD_ANALYTICS_DISABLE="true" \
    cloudypad-test-install-alpine:local \
    sh -c 'cat /cloudypad/install.sh | sh && PATH=$PATH:/root/.cloudypad/bin && echo $PATH && which cloudypad || (echo "Cloudypad not found on PATH after install" && false)'