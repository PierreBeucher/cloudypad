#!/bin/sh

set -e

#
# Create a release from current commit.
#
# Gotcha:
# - Must be run after release-please PR has been merged.
# - If script fails, it can be restarted safely and should be reasonably idempotent
#
# 

if [ -z ${GITHUB_TOKEN+x} ]; then 
    echo "GITHUB_TOKEN variable must be set (with read/write permissions on content and pull requests)"
    exit 1
fi

GIT_CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
read -p "Creating release tag for branch '${GIT_CURRENT_BRANCH}' ? (yN)" CONFIRM_TAG

if [[ $CONFIRM_TAG =~ ^[Yy]$ ]]; then

    npx release-please github-release \
        --repo-url https://github.com/PierreBeucher/cloudypad \
        --token=${GITHUB_TOKEN} \
        --target-branch $GIT_CURRENT_BRANCH
fi