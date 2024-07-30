#!/usr/bin/env bash

set -e

NEW_VERSION=$(cat package.json | jq -r .version)
REPO="crafteo/cloudypad"

docker buildx build \
  -t $REPO:$NEW_VERSION -t $REPO:latest \
  --platform=linux/amd64,linux/arm64 \
  .

read -p "Push images $REPO:$NEW_VERSION and $REPO:latest ? (yN) " PUSH

if [[ $PUSH =~ ^[Yy]$ ]]; then
  docker buildx build \
  -t $REPO:$NEW_VERSION -t $REPO:latest \
  --platform=linux/amd64,linux/arm64 \
  --push \
  .
fi