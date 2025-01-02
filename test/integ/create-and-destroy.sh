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
export CLOUDYPAD_CLI_LAUNCHER_DEBUG=true

# Use container image or local script directly
# Faster with local script but may miss container image issue

task build-local > /dev/null && cloudypad_cmd="./cloudypad.sh"
# cloudypad_cmd="npx ts-node src/index.ts"

function create_destroy_aws() {
    
    instance_name="test-create-destroy-aws"

    $cloudypad_cmd create aws \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --instance-type g4dn.xlarge \
        --disk-size 100 \
        --public-ip-type static \
        --region eu-central-1 \
        --spot \
        --yes --overwrite-existing

    $cloudypad_cmd update aws \
        --name $instance_name \
        --disk-size 101 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait
    
    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name
}

function create_destroy_paperspace() {
    
    instance_name="test-create-destroy-paperspace"

    $cloudypad_cmd create paperspace \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --machine-type P4000 \
        --disk-size 100 \
        --public-ip-type static \
        --region "East Coast (NY2)" \
        --yes --overwrite-existing

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd destroy $instance_name
}

function create_destroy_azure() {
    
    instance_name="test-create-destroy-azure"

    $cloudypad_cmd create azure \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --vm-size Standard_NC8as_T4_v3 \
        --disk-size 100 \
        --public-ip-type static \
        --location "francecentral" \
        --spot \
        --subscription-id 0dceb5ed-9096-4db7-b430-2609e7cc6a15 \
        --yes --overwrite-existing

    $cloudypad_cmd update azure \
        --name $instance_name \
        --vm-size Standard_NC4as_T4_v3 \
        --disk-size 100 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name
}

function create_destroy_gcp() {
    
    instance_name="test-create-destroy-gcp"

    npx tsx src/index.ts create gcp \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --machine-type n1-standard-8 \
        --disk-size 100 \
        --public-ip-type static \
        --region "europe-west4" \
        --zone "europe-west4-b" \
        --gpu-type "nvidia-tesla-p4" \
        --project-id crafteo-sandbox \
        --spot \
        --yes --overwrite-existing

    $cloudypad_cmd update gcp \
        --name $instance_name \
        --machine-type n1-standard-4 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name
}

case "$1" in
    aws)
        create_destroy_aws
        ;;
    paperspace)
        create_destroy_paperspace
        ;;
    azure)
        create_destroy_azure
        ;;
    gcp)
        create_destroy_gcp
        ;;
    *)
        echo "Usage: $0 {aws|paperspace|azure|gcp}"
        ;;
esac


