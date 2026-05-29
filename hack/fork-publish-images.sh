#!/usr/bin/env bash

#
# Build and push THIS FORK's container images to ghcr.io/gabbelitov2.
#
# This mirrors what upstream's release CI (.github/workflows/release.yml) does,
# but runs locally — no self-hosted runner or release-please ceremony needed.
#
# Two images are built and pushed:
#   - core:     ghcr.io/gabbelitov2/cloudypad:<version>          (the CLI itself)
#   - sunshine: ghcr.io/gabbelitov2/cloudypad/sunshine:<version> (our customized
#               desktop image with App Installer / Prism Launcher)
#
# The tag must match the Cloudy Pad version, because cloudypad.sh pulls
# ghcr.io/gabbelitov2/cloudypad:<version> and the Sunshine image is pulled with
# the same version tag at deploy time.
#
# Prerequisites:
#   - Nix (the build runs inside `nix develop` like upstream's CI)
#   - Docker with buildx (core image is built multi-platform amd64+arm64)
#   - Logged in to ghcr.io with a token that has `write:packages`:
#       echo <PAT> | docker login ghcr.io -u gabbelitoV2 --password-stdin
#     (a plain `gh auth login` token usually lacks write:packages — create a
#      classic PAT with write:packages, or run: gh auth refresh -s write:packages)
#
# Usage:
#   ./hack/fork-publish-images.sh            # version from package.json
#   ./hack/fork-publish-images.sh 0.45.2     # explicit version
#

set -euo pipefail

VERSION="${1:-$(jq -r .version package.json)}"

echo "Publishing Cloudy Pad fork images for version: $VERSION"
echo "  core:     ghcr.io/gabbelitov2/cloudypad:$VERSION"
echo "  sunshine: ghcr.io/gabbelitov2/cloudypad/sunshine:$VERSION"
echo

# Sanity check: are we logged in to ghcr.io?
if ! grep -q "ghcr.io" ~/.docker/config.json 2>/dev/null; then
  echo "WARNING: no ghcr.io login found in ~/.docker/config.json."
  echo "If the push fails, log in first (needs write:packages):"
  echo "  echo <PAT> | docker login ghcr.io -u gabbelitoV2 --password-stdin"
  echo
fi

echo "==> Building + pushing core image..."
CLOUDYPAD_BUILD_CORE_IMAGE_TAG="$VERSION" nix develop -c task build-core-container-release

echo "==> Building + pushing Sunshine image..."
CLOUDYPAD_BUILD_SUNSHINE_IMAGE_TAG="$VERSION" nix develop -c task build-sunshine-container-release

echo
echo "Done. Pushed:"
echo "  ghcr.io/gabbelitov2/cloudypad:$VERSION"
echo "  ghcr.io/gabbelitov2/cloudypad/sunshine:$VERSION"
echo
echo "Make the packages public on https://github.com/gabbelitoV2?tab=packages"
echo "(or configure pull credentials) so your instances can pull them."
