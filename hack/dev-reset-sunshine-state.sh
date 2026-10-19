#!/usr/bin/env bash
# Reset Sunshine pairing/auth state on a running Cloudy Pad instance.
#
# Fix for "Client certificate not authorized" failures after image change /
# pairing state corruption. Removes Sunshine's server identity (cert.pem/pkey.pem)
# and pairing credentials (sunshine_credentials.json, legacy sunshine_state.json),
# forcing Sunshine to regenerate a fresh identity and clean pairing state.
#
# Moonlight side must then: forget the host (stored server cert is now invalid)
# and re-pair fresh with task dev:pin.
#
# Sunshine 2026+ state layout (all under /cloudy/data/sunshine/):
#   - cert.pem / pkey.pem          server identity (regenerated when missing)
#   - sunshine_credentials.json    web UI credentials
#   - sunshine_state.json          legacy 2025 pairing state (absent on 2026+)
#
# Implementation notes:
#   - supervisorctl is NOT usable: supervisord.conf has no unix_http_server
#     section, so supervisorctl fails with "unix:///var/run/supervisor.sock no such file"
#   - docker exec cannot run on a stopped container, and Sunshine may rewrite
#     credentials on shutdown: stop the container, wipe via the host bind mount,
#     then start it again
#
# Usage: ./hack/dev-reset-sunshine-state.sh <instance IP>
set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <instance IP>"
    exit 1
fi

IP="$1"
SSH_KEY="${HOME}/.ssh/id_ed25519"
CONTAINER="cloudy"
# Host-side bind mount of container path /cloudy/data/sunshine/
STATE_DIR="/var/lib/cloudypad/sunshine/data/sunshine"
STATE_FILES="sunshine_state.json sunshine_credentials.json cert.pem pkey.pem"

SSH_OPTS=(-o StrictHostKeyChecking=no -i "$SSH_KEY")

ssh_instance() {
    ssh "${SSH_OPTS[@]}" "root@$IP" "$1"
}

echo "Stopping $CONTAINER container on $IP (prevents Sunshine rewriting state on shutdown)"
ssh_instance "docker stop $CONTAINER" > /dev/null

echo "Removing Sunshine pairing/credentials state"
ssh_instance "rm -f $(for f in $STATE_FILES; do printf '%s ' "$STATE_DIR/$f"; done)"
ssh_instance "ls -la $STATE_DIR/"

echo "Starting $CONTAINER container"
ssh_instance "docker start $CONTAINER" > /dev/null

echo "Waiting for Sunshine to come back up (regenerates identity + credentials)"
for i in $(seq 1 30); do
    UP=$(ssh_instance "docker exec $CONTAINER sh -c 'pgrep -c sunshine' 2>/dev/null || true")
    if [ "$UP" -gt 0 ]; then
        echo "Sunshine is up (attempt $i)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Sunshine did not come back within timeout. Check container logs:" >&2
        echo "  ssh root@$IP docker logs $CONTAINER" >&2
        exit 1
    fi
    sleep 2
done

echo "New Sunshine state:"
ssh_instance "docker exec -u root $CONTAINER sh -c 'ls -la /cloudy/data/sunshine/'"

echo
echo "Sunshine state reset."
echo "Next steps:"
echo "  1. Forget the host in Moonlight (remove saved pairing entry - server identity changed)"
echo "  2. Re-pair: start Moonlight (it will show a PIN), then: task dev:pin -- $IP <PIN>"
