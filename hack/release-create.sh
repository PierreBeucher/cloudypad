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
      --repo-url https://github.com/PierreBeucher/cloudypad \
      --token $GITHUB_TOKEN \
      --target-branch $release_branch

  echo "Release is ready to be merged in release branch. You can review PR before merge."
  read -p "Press enter to continue and merge PR automatically..."

  gh pr merge "release-please--branches--$release_branch--components--cloudypad" --merge

  echo "Pulling Release Please changes in $release_branch..."

  git pull

  read -p "Press enter to continue and create GitHub release..."

  # Release has been merged in release branch and tag created
  # Create GitHub release from Git tag
  npx release-please github-release \
    --repo-url https://github.com/PierreBeucher/cloudypad \
    --token=${GITHUB_TOKEN} \
    --target-branch $release_branch
}

merge_release_branch_in_master() {
  release_version=$1
  release_branch="release-$release_version"

  if [ "$CLOUDYPAD_RELEASE_DRY_RUN" = true ]; then
    echo "Dry run enabled: Skipping release branch merge in master."
    return
  fi

  read -p "About to merge release branch $release_branch in master. Continue ?"

  gh pr create \
    --title "Finalize release $release_version" \
    --body "" \
    --base master \
    --head $release_branch

  gh pr merge $release_branch --merge

  echo "Checking out and pulling master after release..."

  git checkout master && git pull
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
