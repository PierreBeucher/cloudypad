#!/usr/bin/env bash
# Pair a Cloudy Pad instance with Moonlight, fully non-interactive:
# 1. Check the instance is running
# 2. Resolve the instance host from its state
# 3. Check for a stale Moonlight host entry with the same hostname (destroyed
#    and recreated instances keep the old server identity in Moonlight config,
#    which blocks pairing with "Found unexpected PC" - same name, new cert).
#    We never touch the user's Moonlight config: if one exists, ask the user
#    to remove it and abort.
# 4. Generate a PIN
# 5. Run `cloudypad pair <name> --pin <PIN>` in background: it polls the
#    Sunshine API waiting for the pending pairing session and confirms it
# 6. Run moonlight pair with the same PIN: it creates the pending session
# 7. Verify end-to-end with moonlight list
#
# A healthy pairing completes within ~10s (moonlight handshake ~6s, pairer
# confirms on its next 2s poll). The pairer confirmation is the health bar:
# if it does not happen within DEADLINE_SECS, something is wrong with the
# instance (Sunshine not responding, degraded network...) and the script
# fails fast with diagnostics instead of polling for minutes.
#
# Moonlight never exits on its own (GUI process): once the pairer confirms,
# the script gives Moonlight a short grace window to observe the pairing
# completion and save the host entry, then kills it. The end-to-end
# verification below is the final verdict.
#
# Moonlight is invoked through MOONLIGHT_CMD (default: Flatpak install).
# Paired host is stored in the user's real Moonlight config.
#
# Usage: task dev:pair -- <instance-name>
set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <instance-name>"
    exit 1
fi

NAME="$1"
CLI="npx tsx src/cli/main.ts"
LOG="tmp/dev-pair-$NAME.log"
DEADLINE_SECS="${DEV_PAIR_TIMEOUT_SECS:-10}"
MOONLIGHT_GRACE_SECS=10

MOONLIGHT_CMD=${MOONLIGHT_CMD:-"flatpak run com.moonlight_stream.Moonlight"}
MOONLIGHT_CONFIG=${MOONLIGHT_CONFIG:-"$HOME/.var/app/com.moonlight_stream.Moonlight/config/Moonlight Game Streaming Project/Moonlight.conf"}

STATUS=$($CLI get "$NAME" | jq -r '.status.serverStatus')
if [ "$STATUS" != "running" ]; then
    echo "ERROR: instance $NAME is not running (status: $STATUS). Start it first: $CLI start $NAME" >&2
    exit 1
fi

HOST=$($CLI get "$NAME" | jq -r '.provision.output.host')
if [ -z "$HOST" ] || [ "$HOST" = "null" ]; then
    echo "ERROR: could not resolve host of instance $NAME" >&2
    exit 1
fi

# Detect a stale same-hostname Moonlight entry: a destroyed and recreated
# instance has a new server cert/uuid, Moonlight matches by hostname and the
# stale entry blocks pairing. We do not modify the user's Moonlight config:
# ask them to remove the stale host themselves (Moonlight UI or config file).
if [ -f "$MOONLIGHT_CONFIG" ] && grep -q "hostname=${NAME}\$" "$MOONLIGHT_CONFIG"; then
    echo "ERROR: Moonlight config already has a host entry named '$NAME' (likely stale from a previous instance with the same name)." >&2
    echo "Remove it before pairing, then re-run this task:" >&2
    echo "  - In the Moonlight UI: remove the host '$NAME', or" >&2
    echo "  - Manually edit $MOONLIGHT_CONFIG (hosts section)" >&2
    exit 1
fi

PIN=$(printf '%04d' $((RANDOM % 10000)))

echo "Pairing instance $NAME ($HOST) with PIN $PIN (pairer confirmation within ${DEADLINE_SECS}s or something is wrong)..."
echo "  (pairer output: $LOG)"

$CLI pair "$NAME" --pin "$PIN" > "$LOG" 2>&1 &
PAIR_PID=$!

start=$(date +%s)

# The pairer is authoritative: moonlight may exit without server-side
# confirmation, only the pairer proves Sunshine accepted the PIN
$MOONLIGHT_CMD pair "$HOST" --pin "$PIN" &
MOONLIGHT_PID=$!

PAIRER_OK=false
while kill -0 "$PAIR_PID" 2>/dev/null; do
    if [ $(( $(date +%s) - start )) -ge $DEADLINE_SECS ]; then
        kill "$PAIR_PID" 2>/dev/null || true
        kill "$MOONLIGHT_PID" 2>/dev/null || true
        break
    fi
    sleep 1
done

if wait "$PAIR_PID"; then
    PAIRER_OK=true
fi
PAIRER_CONFIRM_SECS=$(( $(date +%s) - start ))

if [ "$PAIRER_OK" != "true" ]; then
    echo "ERROR: pairer did not confirm within ${DEADLINE_SECS}s (still running after ${PAIRER_CONFIRM_SECS}s) - something is wrong." >&2
    echo "Diagnostics:" >&2
    echo "  - pairer output (tail):" >&2
    tail -10 "$LOG" >&2 || true
    echo "  - check the instance: docker ps (container healthy?), /cloudy/log/sunshine.log on the instance" >&2
    exit 1
fi

echo "Pairer confirmed pairing in ${PAIRER_CONFIRM_SECS}s"

# Moonlight never exits on its own: it already created the pending session
# the pairer confirmed. Give it a short grace window to observe the pairing
# completion and save the host entry in its config, then kill it. The
# end-to-end verification below is the final verdict.
sleep $MOONLIGHT_GRACE_SECS
kill "$MOONLIGHT_PID" 2>/dev/null || true

# End-to-end verification: the saved host entry must list apps from the instance
if $MOONLIGHT_CMD list "$HOST" 2>/dev/null | grep -q "Desktop"; then
    echo "Instance $NAME paired successfully with Moonlight host $HOST (pairer confirmed in ${PAIRER_CONFIRM_SECS}s)"
else
    echo "Warning: pairing confirmed by Sunshine but moonlight list did not show the host apps - verify manually:" >&2
    echo "  $MOONLIGHT_CMD list $HOST" >&2
    exit 1
fi
