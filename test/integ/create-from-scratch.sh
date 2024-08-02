#!/usr/bin/env bash

#
# Manual test to run a full creation / basic usage / deletion workflow from scratch
# without user interaction to verify the CLI "happy path" usage is working as expected
#
# Remain manual for now to ensure our AWS instance doesn't remain alive costing $$$
#

set -e

# Build local image to run tests
export CLOUDYPAD_IMAGE="crafteo/cloudypad:local"
task build

cloudypad_cmd="./cloudypad.sh"
# cloudypad_cmd="npx ts-node src/index.ts"

$cloudypad_cmd list

$cloudypad_cmd create aws \
    --name test-aws \
    --private-ssh-key ~/.ssh/id_ed25519 \
    --instance-type g4dn.xlarge \
    --disk-size 100 \
    --public-ip-type static \
    --region eu-central-1 \
    --yes --overwrite-existing

$cloudypad_cmd get test-aws

$cloudypad_cmd stop test-aws

$cloudypad_cmd destroy test-aws