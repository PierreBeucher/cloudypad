#!/usr/bin/env bash

#
# Create release PR for current branch
#

set -e

if [ -z ${GITHUB_TOKEN+x} ]; then 
    echo "GITHUB_TOKEN variable must be set (with read/write permissions on content and pull requests)"
    exit 1
fi

GIT_CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

read -p "Creating release PR for branch '${GIT_CURRENT_BRANCH}' ? (yN)" CONFIRM_PR

if [[ $CONFIRM_PR =~ ^[Yy]$ ]]; then
    npx release-please release-pr \
        --repo-url https://github.com/PierreBeucher/cloudypad \
        --token $GITHUB_TOKEN \
        --target-branch $GIT_CURRENT_BRANCH
fi

