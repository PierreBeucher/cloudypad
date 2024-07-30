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
sed -i "s/DEFAULT_CLOUDYPAD_VERSION=$VERSION_REGEX/DEFAULT_CLOUDYPAD_VERSION=$NEW_VERSION/" install.sh

# Replace version in flake.nix with any semantic version including those with additional characters
sed -i "s/version = \"$VERSION_REGEX\";/version = \"$NEW_VERSION\";/" flake.nix

# Replace version in package.json with any semantic version including those with additional characters
sed -i "s/\"version\": \"$VERSION_REGEX\"/\"version\": \"$NEW_VERSION\"/" package.json
