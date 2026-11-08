#!/usr/bin/env bash

wait-x-availability.sh

PRISMLAUNCHER_APPIMAGE_PATH="/opt/prismlauncher/PrismLauncher.AppImage"

if [ ! -x "$PRISMLAUNCHER_APPIMAGE_PATH" ]; then
  echo "Prism Launcher is not installed."
  echo "Run 'install-prismlauncher.sh' to install it."
  zenity --error --text="Prism Launcher is not installed.\n\nOpen a terminal and run:\ninstall-prismlauncher.sh" --title="Prism Launcher" 2>/dev/null || true
  exit 1
fi

cd "$CLOUDYPAD_USER_HOME"

"$PRISMLAUNCHER_APPIMAGE_PATH" &

PRISMLAUNCHER_PID=$!
echo $PRISMLAUNCHER_PID > /tmp/prismlauncher.pid
echo "Prism Launcher started with PID: $PRISMLAUNCHER_PID"

wait $PRISMLAUNCHER_PID
