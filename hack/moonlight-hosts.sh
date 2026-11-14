#!/usr/bin/env bash
# List and delete Moonlight hosts (paired "instances") directly in the Moonlight config.
#
# The Moonlight CLI has no command to list or remove hosts (moonlight list <host>
# only lists a host's apps): hosts live in the QSettings config file as [hosts]
# groups keyed "N\key=value" with a bare "size=N" line as the host count.
# This script parses and edits that file:
#   - an entry is considered paired when its srvcert=@ByteArray(...) is non-empty
#   - deleting a group renumbers the remaining groups (QSettings expects
#     contiguous 1..size indexes) and decrements the section size
#   - a timestamped backup is written next to the config before any edit
#
# Never edit the file while Moonlight is running: its in-memory state would
# overwrite the edit when it exits.
#
# Config path follows the same convention as dev-pair.sh (Flatpak install by
# default, overridable with MOONLIGHT_CONFIG). Verified: exiting Moonlight
# does not overwrite external edits, so the file can be edited while
# Moonlight runs.
#
# Usage:
#   moonlight-hosts.sh list
#   moonlight-hosts.sh delete <index>
#   moonlight-hosts.sh delete-all
set -euo pipefail

MOONLIGHT_CONFIG=${MOONLIGHT_CONFIG:-"$HOME/.var/app/com.moonlight_stream.Moonlight/config/Moonlight Game Streaming Project/Moonlight.conf"}

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Read-only: listing does not require Moonlight to be closed
list_hosts() {
    awk '
    BEGIN { inhosts = 0; size = 0 }
    /^\[hosts\]/ { inhosts = 1; next }
    inhosts && /^\[/ { inhosts = 0 }
    inhosts && /^size=/ { size = substr($0, 6) + 0; next }
    inhosts && match($0, /^([0-9]+)\\hostname=/, m) { i = m[1] + 0; line = $0; sub(/^[^=]*=/, "", line); host[i] = line }
    inhosts && match($0, /^([0-9]+)\\manualaddress=/, m) { i = m[1] + 0; line = $0; sub(/^[^=]*=/, "", line); addr[i] = line }
    inhosts && match($0, /^([0-9]+)\\uuid=/, m) { i = m[1] + 0; line = $0; sub(/^[^=]*=/, "", line); uuid[i] = line }
    inhosts && match($0, /^([0-9]+)\\srvcert=/, m) { i = m[1] + 0; line = $0; paired[i] = (line ~ /@ByteArray\(.+\)/) ? "yes" : "NO" }
    END {
        if (size == 0) { print "(no hosts)" ; exit 0 }
        printf "%-4s %-7s %-30s %-16s %s\n", "IDX", "PAIRED", "HOSTNAME", "ADDRESS", "UUID"
        for (i = 1; i <= size; i++) {
            printf "%-4d %-7s %-30s %-16s %s\n", i, paired[i], host[i], addr[i], substr(uuid[i], 1, 36)
        }
    }' "$MOONLIGHT_CONFIG"
}

# Host count according to the [hosts] section size
hosts_size() {
    awk '
    BEGIN { inhosts = 0; size = -1 }
    /^\[hosts\]/ { inhosts = 1; next }
    inhosts && /^\[/ { exit }
    inhosts && /^size=/ { size = substr($0, 6) + 0; exit }
    END { if (size < 0) size = 0; print size }
    ' "$MOONLIGHT_CONFIG"
}

backup_config() {
    local backup
    backup="${MOONLIGHT_CONFIG}.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$MOONLIGHT_CONFIG" "$backup"
    echo "Backup: $backup"
}

write_edited() {
    awk -v del="$1" '
    BEGIN { inhosts = 0 }
    /^\[hosts\]/ { inhosts = 1; print; next }
    inhosts && /^\[/ { inhosts = 0 }
    inhosts && /^size=/ { print "size=" substr($0, 6) - 1; next }
    inhosts && /^[0-9]+\\/ {
        p = index($0, "\\")
        idx = substr($0, 1, p - 1) + 0
        if (idx == del) { next }
        if (idx > del) { print (idx - 1) "\\" substr($0, p + 1); next }
    }
    { print }
    ' "$MOONLIGHT_CONFIG"
}

write_empty() {
    awk '
    BEGIN { inhosts = 0 }
    /^\[hosts\]/ { inhosts = 1; print; next }
    inhosts && /^\[/ { inhosts = 0 }
    inhosts && /^size=/ { print "size=0"; next }
    inhosts && /^[0-9]+\\/ { next }
    { print }
    ' "$MOONLIGHT_CONFIG"
}

apply_edit() {
    local tmp
    tmp=$(mktemp)
    "$@" > "$tmp"
    mv "$tmp" "$MOONLIGHT_CONFIG"
}

[ -f "$MOONLIGHT_CONFIG" ] || die "Moonlight config not found: $MOONLIGHT_CONFIG"

ACTION=${1:-list}

case "$ACTION" in
    list)
        list_hosts
        ;;
    delete)
        [ $# -eq 2 ] || die "Usage: $0 delete <index>  (see '$0 list')"
        IDX=$2
        SIZE=$(hosts_size)
        [[ "$IDX" =~ ^[0-9]+$ ]] && [ "$IDX" -ge 1 ] && [ "$IDX" -le "$SIZE" ] \
            || die "Index '$IDX' is out of range (1..$SIZE). Run '$0 list' first."
        grep -q "^${IDX}\\\\hostname=" "$MOONLIGHT_CONFIG" || die "No host at index $IDX"

        backup_config
        apply_edit write_edited "$IDX"
        echo "Deleted host $IDX. Remaining hosts:"
        list_hosts
        ;;
    delete-all)

        backup_config
        apply_edit write_empty
        echo "Deleted all hosts:"
        list_hosts
        ;;
    *)
        die "Usage: $0 {list|delete <index>|delete-all}"
        ;;
esac
