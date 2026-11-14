#!/usr/bin/env bash
set -euo pipefail

#
# Give CLOUDYPAD_USER passwordless sudo access
#

# Check if running as root
if [[ $(id -u) -ne 0 ]]; then
    echo "This script must be run as root" >&2
    exit 1
fi

echo "Adding passwordless sudo for CLOUDYPAD_USER $CLOUDYPAD_USER"

cat > /etc/sudoers.d/cloudy << EOF
$CLOUDYPAD_USER ALL=(ALL) NOPASSWD: ALL
EOF
chmod 440 /etc/sudoers.d/cloudy

echo "Cloudy user has been added to sudoers with passwordless access"
