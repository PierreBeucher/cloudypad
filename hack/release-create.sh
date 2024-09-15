#!/usr/bin/env bash

#
# Create a new Cloudy Pad release with Git tag and container image
#

set -e

if [ -z ${GITHUB_TOKEN+x} ]; then 
    echo "GITHUB_TOKEN variable must be set (with read/write permissions on content and pull requests)"
    exit 1
fi

if [ -z "$1" ]; then
  read -p "Release version? " new_version
else 
    new_version=$1
fi

release_branch="release-$new_version"

read -p "New version: $new_version with release branch '$release_branch'. Continue? (If something goes wrong, delete branch and try again)"

echo "Checking out new branch '$release_branch'..."

git checkout -b "$release_branch"

echo "Updating Cloudy Pad version in package files and scripts..."

VERSION_REGEX="[0-9]\+\.[0-9]\+\.[0-9]\+\([-a-zA-Z0-9]*\)\?"

# Replace CLOUDYPAD_VERSION in cloudypad.sh with any semantic version including those with additional characters
sed -i "s/CLOUDYPAD_VERSION=$VERSION_REGEX/CLOUDYPAD_VERSION=$new_version/" cloudypad.sh
sed -i "s/DEFAULT_CLOUDYPAD_SCRIPT_REF=v$VERSION_REGEX/DEFAULT_CLOUDYPAD_SCRIPT_REF=v$new_version/" install.sh

# package.json
sed -i "s/\"version\": \"$VERSION_REGEX\"/\"version\": \"$new_version\"/" package.json

# flake.nix
sed -i "s/cloudypadVersion = \"$VERSION_REGEX\";/cloudypadVersion = \"$new_version\";/" flake.nix

# Make sure the hash of cloudypad.sh matches the one in pkgs.fetchurl cloudypad.sh from flake.nix
NIX_SHA256=$(nix-prefetch-url "file://$PWD/cloudypad.sh" --type sha256)
sed -i "s/hash = \"sha256:.*\";/hash = \"sha256:${NIX_SHA256}\";/" flake.nix

echo "Commiting and pushing version change to $release_branch..."

git add package.json cloudypad.sh install.sh flake.nix
git commit -m "chore: prepare release $new_version - update version in package files and scripts"
git push

echo "Creating release PR..."

npx --yes release-please release-pr \
    --repo-url https://github.com/PierreBeucher/cloudypad \
    --token $GITHUB_TOKEN \
    --target-branch $release_branch

echo "Release is ready to be merged ! Review Release Please PR and merge to continue."
read -p "Once Release Please PR has been merged, press Enter to continue..."

echo "Pulling Release Please changes in $release_branch..."

git pull

echo "Building release... (may take some time)"

docker_repo="crafteo/cloudypad"

docker buildx build \
  -t $docker_repo:$new_version -t $docker_repo:latest \
  --platform=linux/amd64,linux/arm64 \
  .

echo "Push images $docker_repo:$new_version and $docker_repo:latest..."

docker buildx build \
  -t $docker_repo:$new_version -t $docker_repo:latest \
  --platform=linux/amd64,linux/arm64 \
  --push \
  .

if [ -z ${GITHUB_TOKEN+x} ]; then 
    echo "GITHUB_TOKEN variable must be set (with read/write permissions on content and pull requests)"
    exit 1
fi

npx release-please github-release \
    --repo-url https://github.com/PierreBeucher/cloudypad \
    --token=${GITHUB_TOKEN} \
    --target-branch $release_branch

read -p "About to merge release branch $release_branch in master. Continue ?"

gh pr create \
  --title "Finalize release $new_version" \
  --body "" \
  --base master \
  --head $release_branch

gh pr merge $release_branch --merge

echo "Checking out and pulling master after release..."

git checkout master && git pull

echo "Release done ! ✨"
