#!/usr/bin/env bash
set -euo pipefail

#
# Dev feedback loop: build + deploy the Sunshine container to the local
# Vagrant dev VM. Runs:
#   1. Save the locally built Sunshine image to a tarball
#   2. Copy it to the dev VM
#   3. Load it into the VM's Docker
#   4. Re-render Compose config with Ansible (sunshine-docker tag)
#   5. Recreate the Sunshine container with the new image
#
# Expects the image to be built already with CLOUDYPAD_BUILD_SUNSHINE_IMAGE_*
# environment variables set (as done by the "task dev-docker-sunshine-to-vm"
# wrapper which builds it first, see Taskfile.yml).
#
# Usage: ./hack/dev-docker-sunshine-to-vm.sh
#

VM_SSH_KEY=".vagrant/machines/default/virtualbox/private_key"
VM_ADDR="vagrant@192.168.56.43"
IMAGE_TARBALL="tmp/sunshine-container-image.tar"
COMPOSE_FILE="sunshine/docker-compose.yml"

echo "Saving image $CLOUDYPAD_BUILD_SUNSHINE_IMAGE_REGISTRY:$CLOUDYPAD_BUILD_SUNSHINE_IMAGE_TAG to $IMAGE_TARBALL"
docker image save "$CLOUDYPAD_BUILD_SUNSHINE_IMAGE_REGISTRY:$CLOUDYPAD_BUILD_SUNSHINE_IMAGE_TAG" -o "$IMAGE_TARBALL"

# Fail BEFORE scp/deploy: the VM would otherwise keep the previous image
# and the failure would be silent
if [ ! -s "$IMAGE_TARBALL" ]; then
    echo "ERROR: docker image save produced no file (host disk full? check 'df -h .'). Aborting BEFORE scp/deploy: the VM would keep the previous image and the failure would be silent." >&2
    exit 1
fi

scp -i "$VM_SSH_KEY" "$IMAGE_TARBALL" "$VM_ADDR:/tmp"

echo "Loading image into VM's Docker..."
# Fail BEFORE deploy: a silently missing image would keep the VM running
# the previous container
if ! ssh -i "$VM_SSH_KEY" "$VM_ADDR" docker load -i /tmp/sunshine-container-image.tar | grep -q "Loaded image:"; then
    echo "ERROR: docker load failed on VM (VM disk full? wipes /var/lib/containerd are safe: see AGENTS.md). Aborting BEFORE deploy." >&2
    exit 1
fi

echo "Re-rendering Compose config with Ansible..."
ansible-playbook -i ansible/inventories/dev-vagrant.yml ansible/sunshine.yml -t sunshine-docker

echo "Recreating Sunshine container..."
ssh -i "$VM_SSH_KEY" "$VM_ADDR" docker compose -f "$COMPOSE_FILE" -p sunshine up -d --force-recreate
