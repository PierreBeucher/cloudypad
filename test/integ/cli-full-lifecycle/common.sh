#!/usr/bin/env bash


set -e

# Build local image to run tests
export CLOUDYPAD_IMAGE="crafteo/cloudypad:local"
export CLOUDYPAD_CLI_LAUNCHER_DEBUG=true

# Use container image or local script directly
# Faster with local script but may miss container image issue

task build-local > /dev/null && cloudypad_cmd="./cloudypad.sh"
# cloudypad_cmd="npx ts-node src/index.ts"