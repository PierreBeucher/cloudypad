#!/usr/bin/env bash

#
# Create a new Cloudy Pad release with Git tag and container images
#

# If dry run enabled
# - Docker images are built but not pushed
# - Git branch created but not pushed
# - Version changes are committed but not pushed
# - Git tag not created
# - GitHub PRs not created
# - GitHub release not created
CLOUDYPAD_RELEASE_DRY_RUN=${CLOUDYPAD_RELEASE_DRY_RUN:-false}

# Update versions in package files and scripts
# install.sh, cloudypad.sh, package.json, flake.nix
update_versions_in_package_files() {
  release_version=$1

  echo "Updating Cloudy Pad version in package files and scripts..."

  VERSION_REGEX="[0-9]\+\.[0-9]\+\.[0-9]\+\([-a-zA-Z0-9]*\)\?"

  echo "Updating CLOUDYPAD_VERSION in cloudypad.sh and install.sh..."

  # Replace CLOUDYPAD_VERSION in cloudypad.sh with any semantic version including those with additional characters
  sed -i "s/CLOUDYPAD_VERSION=$VERSION_REGEX/CLOUDYPAD_VERSION=$release_version/" cloudypad.sh
  sed -i "s/DEFAULT_CLOUDYPAD_SCRIPT_REF=v$VERSION_REGEX/DEFAULT_CLOUDYPAD_SCRIPT_REF=v$release_version/" install.sh

  echo "Updating version in package.json..."
  sed -i "s/\"version\": \"$VERSION_REGEX\"/\"version\": \"$release_version\"/" package.json

  echo "Updating version and hash in flake.nix..."
  sed -i "s/cloudypadVersion = \"$VERSION_REGEX\";/cloudypadVersion = \"$release_version\";/" flake.nix

  # Make sure the hash of cloudypad.sh matches the one in pkgs.fetchurl cloudypad.sh from flake.nix
  NIX_SHA256=$(nix-prefetch-url "file://$PWD/cloudypad.sh" --type sha256)
  sed -i "s/hash = \"sha256:.*\";/hash = \"sha256:${NIX_SHA256}\";/" flake.nix
}


create_push_release_branch() {
  release_version=$1
  release_branch="release-$release_version"

  read -p "New version: $release_version with release branch '$release_branch'. Continue? (If something goes wrong, delete branch and try again)"

  echo "Checking out new branch '$release_branch'..."

  git checkout -b "$release_branch"

  echo "Commiting and pushing version changes to $release_branch..."

  git add package.json cloudypad.sh install.sh flake.nix
  git commit -m "chore: prepare release $release_version - update version in package files and scripts"
  
  if [ "$CLOUDYPAD_RELEASE_DRY_RUN" = true ]; then
    echo "Dry run enabled: Skipping git push."
  else
    git push
  fi
}

create_release_pr_and_merge_in_release_branch() {
  release_version=$1
  release_branch="release-$release_version"

  if [ "$CLOUDYPAD_RELEASE_DRY_RUN" = true ]; then
    echo "Dry run enabled: Skipping release PR creation and merge."
    return
  fi

  echo "Creating release PR..."

  npx --yes release-please release-pr \
      --repo-url https://github.com/gabbelitoV2/cloudypad \
      --token $GITHUB_TOKEN \
      --target-branch $release_branch

  echo "Release is ready to be merged in release branch."

  gh pr merge "release-please--branches--$release_branch--components--cloudypad" --merge

  echo "Pulling Release Please changes in $release_branch..."

  git pull

  # Release has been merged in release branch
  # Create Git tag and GitHub release
  # Git tag will result in new Docker images being pushed
  npx release-please github-release \
    --repo-url https://github.com/gabbelitoV2/cloudypad \
    --token=${GITHUB_TOKEN} \
    --target-branch $release_branch \
    --draft
}

merge_release_branch_in_master() {
  release_version=$1
  release_branch="release-$release_version"
  release_tag="v$release_version"
  
  if [ "$CLOUDYPAD_RELEASE_DRY_RUN" = true ]; then
    echo "Dry run enabled: Skipping release branch merge in master."
    return
  fi

  echo "Waiting for release tag CI jobs (Docker image build) to finish on tag $release_tag..."
  
  timeout=1200  # Set timeout to 20 minutes (1200 seconds)
  start_time=$(date +%s)
  release_jobs_success=false

  while true; do
    current_time=$(date +%s)
    elapsed_time=$((current_time - start_time))

    if [ $elapsed_time -ge $timeout ]; then
      echo "Timeout reached: CI jobs did not complete within $timeout seconds."
      exit 1
    fi

    # Check for jobs on release tag
    # Output is like: [ { { "name": "Release", "status": "in_progress" }]
    release_jobs_response=$(gh run list -b "$release_tag" --json status,name)

    echo "[$(date +%Y-%m-%d-%H:%M:%S)] Release jobs status: $release_jobs_response"

    # filter for jobs with status "in_progress"
    release_job_status=$(echo "$release_jobs_response" | jq -r '.[] | select(.name == "Release") | .status')

    echo "Release job status: '$release_job_status'"

    # If no jobs are running (release_jobs_in_progress is an empty string), break: all release jobs completed
    if [ "$release_job_status" = "completed" ]; then
      echo "Release CI job completed for $release_tag"
      release_jobs_success=true
      break
    else
      echo "CI jobs still running for $release_tag. Waiting..."
      sleep 30
    fi
  done

  read -p "Merge release branch $release_branch into master? (y/N): " confirm_merge
  if [[ "$confirm_merge" != "y" ]]; then
    echo "Merge aborted."
    exit 1
  fi

  if [ "$release_jobs_success" = true ]; then
    echo "Merging release branch $release_branch in master..."

    gh pr create \
      --title "Finalize release $release_version" \
      --body "" \
      --base master \
      --head $release_branch

    gh pr merge $release_branch --merge

    echo "Checking out and pulling master after release..."

    git checkout master && git pull
  else
    echo "Timeout reached: CI jobs did not complete within $timeout seconds."
    exit 1
  fi
}

set -e

if [ -z ${GITHUB_TOKEN+x} ]; then 
    echo "GITHUB_TOKEN variable must be set (with read/write permissions on content and pull requests)"
    exit 1
fi

if [ -z "$1" ]; then
  read -p "Release version? " release_version
else 
    release_version=$1
fi

update_versions_in_package_files $release_version
create_push_release_branch $release_version

create_release_pr_and_merge_in_release_branch $release_version
merge_release_branch_in_master $release_version

echo "Release done ! ✨"