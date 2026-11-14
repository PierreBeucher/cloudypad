#!/usr/bin/env bash
# Pair the local Vagrant dev VM's Sunshine with Moonlight, fully non-interactive.
#
# Unlike dev-pair.sh, this does NOT use the Cloudy Pad CLI or any instance
# state: the Vagrant VM is not a Cloudy Pad instance, just a host reachable
# by IP running the Sunshine container deployed by "task dev-docker-sunshine-to-vm".
# The pairer role (normally SunshineMoonlightPairer over instance SSH) is done
# here directly over `vagrant ssh`: poll the Sunshine API for the pending
# pairing session created by Moonlight, then confirm it with the PIN.
#
# Flow:
# 1. Check the Sunshine container is running and healthy on the VM
# 2. Read Sunshine web credentials from the container environment
# 3. Check for a stale Moonlight host entry for the VM address (a destroyed and
#    recreated VM has a new Sunshine identity; the stale entry blocks pairing).
#    We never touch the user's Moonlight config: if one exists, ask the user
#    to remove it and abort.
# 4. Generate a PIN and run `moonlight pair <addr> --pin <PIN>`: it creates
#    the pending pairing session on Sunshine
# 5. Poll the Sunshine API (via vagrant ssh) until the pending session shows
#    up, then POST the PIN (same contract as SunshineMoonlightPairer.pairSendPin)
# 6. Wait for Moonlight to persist the paired host entry, kill it
# 7. Verify end-to-end with moonlight list
#
# A healthy pairing completes within ~10s (moonlight handshake ~6s, poll
# confirms on its next 1s tick): same health bar as dev-pair.sh, fail fast
# with diagnostics instead of polling for minutes.
#
# Moonlight never exits on its own (GUI process): once the API confirms, the
# script waits for Moonlight to persist the new host entry in its config
# (event-driven, with a deadline fallback) then kills it. The end-to-end
# verification below is the final verdict.
#
# Moonlight is invoked through MOONLIGHT_CMD (default: Flatpak install).
# Paired host is stored in the user's real Moonlight config.
#
# Usage: task dev:vagrant-pair
set -euo pipefail

VM_ADDR=${DEV_VM_ADDR:-192.168.56.43}
LOG="tmp/dev-vagrant-pair.log"
DEADLINE_SECS="${DEV_PAIR_TIMEOUT_SECS:-10}"
MOONLIGHT_GRACE_SECS=10

MOONLIGHT_CMD=${MOONLIGHT_CMD:-"flatpak run com.moonlight_stream.Moonlight"}
MOONLIGHT_CONFIG=${MOONLIGHT_CONFIG:-"$HOME/.var/app/com.moonlight_stream.Moonlight/config/Moonlight Game Streaming Project/Moonlight.conf"}

vm_ssh() {
    vagrant ssh -c "$1"
}

echo "Checking Sunshine container on dev VM ($VM_ADDR)..."
STATUS=$(vm_ssh "docker ps --format '{{.Names}} {{.Status}}' --filter name=cloudy" 2>/dev/null || true)
if [[ "$STATUS" != *"cloudy"*"healthy"* ]]; then
    echo "ERROR: 'cloudy' container is not healthy on the dev VM: '$STATUS'" >&2
    echo "Deploy/refresh it first: task dev-docker-sunshine-to-vm" >&2
    exit 1
fi

SUNSHINE_VERSION_LINE=$(vm_ssh "docker exec -u root cloudy grep -a -m1 'Sunshine version' /cloudy/log/sunshine.log" 2>/dev/null || true)
echo "  $SUNSHINE_VERSION_LINE"

# Sunshine web credentials live in the container environment (set by compose
# from the dev inventory). Read them from the running container: whatever the
# VM actually runs, no hardcoded value to keep in sync.
CREDS_RAW=$(vm_ssh "docker exec -u root cloudy printenv SUNSHINE_WEB_USERNAME SUNSHINE_WEB_PASSWORD_BASE64" 2>/dev/null || true)
SUNSHINE_USER=$(echo "$CREDS_RAW" | head -1 | tr -d '\r')
SUNSHINE_PASS=$(echo "$CREDS_RAW" | tail -1 | tr -d '\r' | base64 -d)
if [ -z "$SUNSHINE_USER" ] || [ -z "$SUNSHINE_PASS" ]; then
    echo "ERROR: could not read Sunshine web credentials from the container environment." >&2
    exit 1
fi

# Stale same-address Moonlight entry: a destroyed and recreated VM has a new
# server cert/uuid, Moonlight matches by hostname and the stale entry blocks
# pairing. We do not modify the user's Moonlight config: ask them to remove
# the stale host themselves (Moonlight UI or config file).
#
# We pair by explicit address, which Moonlight stores in `manualaddress=`
# (`hostname=` holds the mDNS-resolved server name, eg. dev-vagrant).
if [ -f "$MOONLIGHT_CONFIG" ] && grep -q "manualaddress=${VM_ADDR}\$" "$MOONLIGHT_CONFIG"; then
    echo "ERROR: Moonlight config already has a host entry for $VM_ADDR (likely stale from a previous VM identity)." >&2
    echo "Remove it before pairing, then re-run this task:" >&2
    echo "  - In the Moonlight UI: remove the host, or" >&2
    echo "  - Manually edit $MOONLIGHT_CONFIG (hosts section)" >&2
    exit 1
fi

PIN=$(printf '%04d' $((RANDOM % 10000)))

echo "Pairing VM $VM_ADDR with PIN $PIN (API confirmation within ${DEADLINE_SECS}s or something is wrong)..."
echo "  (Moonlight output: $LOG)"

# Moonlight in its own process group via setsid: the whole tree it spawns
# (flatpak launcher, bwrap sandbox, xdg-dbus-proxy, moonlight app) inherits
# that group, so cleanup can tear it all down atomically.
setsid $MOONLIGHT_CMD pair "$VM_ADDR" --pin "$PIN" > "$LOG" 2>&1 &
MOONLIGHT_PID=$!

SCRIPT_PGID=$(ps -o pgid= -p $$ | tr -d '[:space:]')
MOONLIGHT_PGID=$(ps -o pgid= -p "$MOONLIGHT_PID" 2>/dev/null | tr -d '[:space:]' || true)

# Never group-kill the script's own process group: if setsid failed or
# Moonlight died before its PGID could be read, fall back to PID-only kill
if [ -z "$MOONLIGHT_PGID" ] || [ "$MOONLIGHT_PGID" = "$SCRIPT_PGID" ]; then
    echo "Warning: no dedicated Moonlight process group, cleanup will kill the launcher PID only" >&2
    MOONLIGHT_PGID=""
fi

# SIGTERM first so the flatpak launcher can tear down its sandbox, then
# SIGKILL the group if anything survived. Group kill takes down launcher +
# bwrap + xdg-dbus-proxy + moonlight atomically.
kill_moonlight_tree() {
    if [ -n "$MOONLIGHT_PGID" ]; then
        kill -- -"$MOONLIGHT_PGID" 2>/dev/null || true
        sleep 2
        if kill -0 -- -"$MOONLIGHT_PGID" 2>/dev/null; then
            kill -9 -- -"$MOONLIGHT_PGID" 2>/dev/null || true
        fi
    else
        kill "$MOONLIGHT_PID" 2>/dev/null || true
        sleep 2
        kill -9 "$MOONLIGHT_PID" 2>/dev/null || true
    fi
}

# Sunshine API over SSH, same contract as SunshineMoonlightPairer.
# Remote commands are shell-quoted with printf %q so credentials and JSON
# payloads survive any special character across the vagrant ssh hop.
api_list_pending() {
    local cmd
    cmd="curl -sk -u $(printf '%q' "$SUNSHINE_USER:$SUNSHINE_PASS") https://localhost:47990/api/pin"
    vm_ssh "$cmd" 2>/dev/null || true
}

api_post_pin() {
    local pairing_id=$1
    local payload cmd
    payload=$(printf '%q' "{\"pairing_id\":\"$pairing_id\",\"pin\":\"$PIN\",\"name\":\"dev-vagrant\"}")
    cmd="curl -sk -u $(printf '%q' "$SUNSHINE_USER:$SUNSHINE_PASS") -X POST https://localhost:47990/api/pin -H 'Content-Type: application/json' -d $payload"
    vm_ssh "$cmd" 2>/dev/null || true
}

# Poll for the pending pairing session created by Moonlight, then confirm it
# with the PIN. Zero pending sessions: Moonlight handshake not done yet,
# retry. Multiple pending sessions: cannot safely guess which one is ours,
# let stale sessions expire and retry.
PAIRER_OK=false
start=$(date +%s)
while true; do
    if [ $(( $(date +%s) - start )) -ge "$DEADLINE_SECS" ]; then
        break
    fi

    PENDING=$(api_list_pending)
    COUNT=$(echo "$PENDING" | jq -r '.pairings | length' 2>/dev/null || echo 0)

    if [ "$COUNT" -eq 1 ]; then
        PAIRING_ID=$(echo "$PENDING" | jq -r '.pairings[0].id')
        RESULT=$(api_post_pin "$PAIRING_ID")
        # Sunshine may answer { "status": "true" } (string) or { "status": true }
        if echo "$RESULT" | jq -r '.status' 2>/dev/null | grep -qE '^"?true"?$'; then
            PAIRER_OK=true
            break
        fi
    elif [ "$COUNT" -gt 1 ]; then
        echo "Warning: multiple pending pairing sessions ($COUNT), skipping PIN attempt to avoid pairing the wrong client" >&2
    fi

    sleep 1
done

CONFIRM_SECS=$(( $(date +%s) - start ))

if [ "$PAIRER_OK" != "true" ]; then
    echo "ERROR: Sunshine API did not confirm the PIN within ${DEADLINE_SECS}s - something is wrong." >&2
    echo "Diagnostics:" >&2
    echo "  - Moonlight output (tail):" >&2
    tail -10 "$LOG" >&2 || true
    echo "  - Sunshine log: vagrant ssh -c 'docker exec -u root cloudy tail -50 /cloudy/log/sunshine.log'" >&2
    exit 1
fi

echo "Sunshine API confirmed the PIN in ${CONFIRM_SECS}s"

# Moonlight never exits on its own: it already created the pending session
# the API confirmed. Kill it as soon as it persists the new host entry in
# its config: the stale-host guard above guarantees no same-address entry
# existed before pairing, so its appearance is proof the pairing was saved.
#
# The entry is written in two stages: address fields first (entry created,
# certs still empty), then the pairing data (srvcert) once pairing completes.
# Only kill once the pairing data is on disk: killing earlier leaves an
# incomplete entry Moonlight treats as unpaired.
#
# Match on `manualaddress=`: `hostname=` holds the mDNS-resolved server name
# (eg. dev-vagrant), not the address we paired with.
moonlight_entry_paired() {
    grep -A14 "manualaddress=${VM_ADDR}\$" "$MOONLIGHT_CONFIG" 2>/dev/null | grep -qE 'srvcert=@ByteArray\(.+\)'
}

# Deadline fallback in case Moonlight is slow to flush (QSettings buffering):
# kill anyway and let the end-to-end verification below be the final verdict.
start=$(date +%s)
while kill -0 "$MOONLIGHT_PID" 2>/dev/null; do
    if moonlight_entry_paired; then
        MOONLIGHT_SAVE_SECS=$(( $(date +%s) - start ))
        echo "Moonlight saved the paired host entry ${MOONLIGHT_SAVE_SECS}s after API confirmation, killing it"
        break
    fi
    if [ $(( $(date +%s) - start )) -ge "$MOONLIGHT_GRACE_SECS" ]; then
        echo "Warning: host entry not seen in Moonlight config within ${MOONLIGHT_GRACE_SECS}s, killing Moonlight anyway" >&2
        break
    fi
    sleep 1
done
kill_moonlight_tree

# End-to-end verification: the saved host entry must list apps from the VM
if $MOONLIGHT_CMD list "$VM_ADDR" 2>/dev/null | grep -q "Desktop"; then
    echo "Dev VM paired successfully with Moonlight host $VM_ADDR (API confirmed in ${CONFIRM_SECS}s)"
else
    echo "Warning: pairing confirmed by Sunshine but moonlight list did not show the host apps - verify manually:" >&2
    echo "  $MOONLIGHT_CMD list $VM_ADDR" >&2
    exit 1
fi
