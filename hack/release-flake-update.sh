#!/usr/bin/env bash

#
# Update flake.nix for new release
# We must perform release first as we need an existing tag to compute hash
# (It may be done without creating release first in theory but it may be complex)
#

set -e

NEW_VERSION=$(cat package.json | jq -r .version)
VERSION_REGEX="[0-9]\+\.[0-9]\+\.[0-9]\+\([-a-zA-Z0-9]*\)\?"

# Replace version in flake.nix with any semantic version including those with additional characters
sed -i "s/cloudypadVersion = \"$VERSION_REGEX\";/cloudypadVersion = \"$NEW_VERSION\";/" flake.nix

NIX_SHA256=$(nix-prefetch-url "https://raw.githubusercontent.com/PierreBeucher/cloudypad/v${NEW_VERSION}/cloudypad.sh" --type sha256)
sed -i "s/hash = \"sha256:.*\";/hash = \"sha256:${NIX_SHA256}\";/" flake.nix
