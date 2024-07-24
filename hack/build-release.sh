#!/usr/bin/env bash

NEW_VERSION=$(cat package.json | jq -r .version)
REPO="crafteo/cloudypad"

docker build -t $REPO:$NEW_VERSION -t $REPO:latest .

read -p "Push images $REPO:$NEW_VERSION and $REPO:latest ? (yN) " PUSH

if [[ $PUSH =~ ^[Yy]$ ]]; then
  docker push $REPO:$NEW_VERSION
  docker push $REPO:latest
fi