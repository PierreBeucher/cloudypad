#!/bin/bash
# Ensure analytics API key match between install.sh and JS app

# Get install.sh analytics key
INSTALL_POSTHOG_API_KEY=$(grep -oP 'INSTALL_POSTHOG_API_KEY="\K[^"]+' install.sh)

# Get JS app analytics key
JS_APP_POSTHOG_API_KEY=$(grep -oP "phc_\w+" src/tools/analytics/client.ts)

if [ "$INSTALL_POSTHOG_API_KEY" != "$JS_APP_POSTHOG_API_KEY" ]; then
  echo "Analytics API key mismatch between install.sh and JS app:"
  echo "install.sh:     '$INSTALL_POSTHOG_API_KEY'"
  echo "JS app:         '$JS_APP_POSTHOG_API_KEY'"
  exit 1
fi

echo "Analytics API key match between install.sh and JS app"