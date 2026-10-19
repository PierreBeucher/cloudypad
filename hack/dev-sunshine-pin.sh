#!/usr/bin/env bash
# Send a Sunshine PIN to a running Cloudy Pad instance, same as `cloudypad pair` CLI.
#
# Sunshine 2026+ pairing API: a pending pairing session (created by the Moonlight
# client waiting for its PIN) must be confirmed with its pairing_id:
#   GET  /api/pin -> { "pairings": [ { "id": "<32 hex>", ... } ] }
#   POST /api/pin { "pairing_id": "...", "pin": "...", "name": "..." }
#
# Usage: ./hack/dev-sunshine-pin.sh <instance IP> <PIN shown by Moonlight>
set -euo pipefail

if [ $# -ne 2 ]; then
    echo "Usage: $0 <instance IP> <PIN>"
    exit 1
fi

IP="$1"
PIN="$2"
SSH_KEY="${HOME}/.ssh/id_ed25519"
SUNSHINE_API="https://localhost:47990/api/pin"

SSH_OPTS=(-o StrictHostKeyChecking=no -i "$SSH_KEY")

ssh_sunshine_api() {
    ssh "${SSH_OPTS[@]}" "root@$IP" \
        "docker exec cloudy curl -sk -u sunshine:Sunshine! -H 'Content-Type: application/json' $1 $SUNSHINE_API"
}

# List pending pairing sessions: the Moonlight client must be waiting for its PIN
PENDING=$(ssh_sunshine_api "")
IDS=$(echo "$PENDING" | grep -oE '"id":"[0-9a-f]{32}"' || true)
COUNT=$(echo "$IDS" | grep -c . || true)

if [ "$COUNT" -eq 0 ]; then
    echo "No pending pairing session on Sunshine: run Moonlight first (it must be waiting for a PIN)."
    exit 1
fi

if [ "$COUNT" -gt 1 ]; then
    echo "Multiple pending pairing sessions, cannot guess which one to pair:"
    echo "$IDS"
    echo "Cancel stale ones in Sunshine Web UI and retry."
    exit 1
fi

PAIRING_ID=$(echo "$IDS" | head -1 | cut -d'"' -f4)
echo "Confirming pending pairing $PAIRING_ID with PIN"

ssh_sunshine_api "-X POST -d '{\"pairing_id\":\"$PAIRING_ID\",\"pin\":\"$PIN\",\"name\":\"my-device\"}'"
