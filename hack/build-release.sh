#!/usr/bin/env bash

# Check if a tag was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <tag>"
  exit 1
fi

TAG=$1
REPO="crafteo/cloudypad"
# Build the Docker image and tag it
docker build -t $REPO:$TAG -t $REPO:latest .

read -p "Push images $REPO:$TAG and $REPO:latest ? (yN) " PUSH

if [[ $PUSH =~ ^[Yy]$ ]]; then
  docker push $REPO:$TAG
  docker push $REPO:latest
fi