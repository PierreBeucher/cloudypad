#!/usr/bin/env bash

#
# labwc session controller, started via `labwc -s`
#
# - Applies initial virtual display resolution
# - Starts the desktop panel (waybar)
#
# When this process exits, labwc exits and supervisor restarts the whole
# compositor session: keep it alive as long as the session should live.
#

set -e

# Wait for the compositor to accept Wayland clients (wlr-randr readiness)
for i in $(seq 1 50); do
    if wlr-randr >/dev/null 2>&1; then
        echo "Compositor is available and working."
        break
    fi
    if [ $i -eq 50 ]; then
        echo "WARNING: compositor not available after 50 attempts"
    fi
    sleep 0.2
done

# Apply initial screen resolution using the same flow as Sunshine sessions
export SUNSHINE_CLIENT_WIDTH=${CLOUDYPAD_SCREEN_INITIAL_WIDTH:-1920}
export SUNSHINE_CLIENT_HEIGHT=${CLOUDYPAD_SCREEN_INITIAL_HEIGHT:-1080}
export SUNSHINE_CLIENT_FPS=${CLOUDYPAD_SCREEN_INITIAL_FPS:-60}
setup-sunshine-screen-mode.sh || echo "WARNING: failed to set initial screen resolution"

# Desktop panel
echo "Starting waybar panel"
waybar -c $XDG_CONFIG_HOME/waybar/config.jsonc -s $XDG_CONFIG_HOME/waybar/style.css &
WAYBAR_PID=$!

# Keep the session alive: exit when the panel dies so labwc and the whole
# session are restarted by supervisor
wait $WAYBAR_PID