#!/usr/bin/env bash

if [ -z "$1" ]; then
  read -p "Release version? " NEW_VERSION
else 
    NEW_VERSION=$1
fi

read -p "New version: $NEW_VERSION. Continue?"

VERSION_REGEX="[0-9]\+\.[0-9]\+\.[0-9]\+\([-a-zA-Z0-9]*\)\?"

# Replace CLOUDYPAD_VERSION in cloudypad.sh with any semantic version including those with additional characters
sed -i "s/CLOUDYPAD_VERSION=$VERSION_REGEX/CLOUDYPAD_VERSION=$NEW_VERSION/" cloudypad.sh
sed -i "s/DEFAULT_CLOUDYPAD_SCRIPT_REF=v$VERSION_REGEX/DEFAULT_CLOUDYPAD_SCRIPT_REF=v$NEW_VERSION/" install.sh

# package.json
sed -i "s/\"version\": \"$VERSION_REGEX\"/\"version\": \"$NEW_VERSION\"/" package.json

# flake.nix
sed -i "s/cloudypadVersion = \"$VERSION_REGEX\";/cloudypadVersion = \"$NEW_VERSION\";/" flake.nix

# Make sure the hash of cloudypad.sh matches the one in pkgs.fetchurl cloudypad.sh from flake.nix
NIX_SHA256=$(nix-prefetch-url "file://$PWD/cloudypad.sh" --type sha256)
sed -i "s/hash = \"sha256:.*\";/hash = \"sha256:${NIX_SHA256}\";/" flake.nix
