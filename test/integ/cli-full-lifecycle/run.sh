#!/usr/bin/env bash

#
# Manual test to run a full creation / basic usage / deletion workflow from scratch
# without user interaction to verify the CLI "happy path" usage is working as expected
#
# Remain manual for now to ensure our AWS instance doesn't remain alive costing $$$
#

set -e

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$script_dir/common.sh"
. "$script_dir/aws.sh"
. "$script_dir/paperspace.sh"
. "$script_dir/azure.sh"
. "$script_dir/gcp.sh"

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