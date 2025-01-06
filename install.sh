#/usr/env/bin bash

set -e

# Installation arguments
# Override by setting related environment variable
DEFAULT_CLOUDYPAD_SCRIPT_REF=v0.11.0
CLOUDYPAD_HOME=${CLOUDYPAD_HOME:-"$HOME/.cloudypad"}
CLOUDYPAD_SCRIPT_REF=${CLOUDYPAD_SCRIPT_REF:-$DEFAULT_CLOUDYPAD_SCRIPT_REF}

INSTALL_POSTHOG_DISTINCT_ID="cli-install-$(date +%Y-%m-%d-%H-%M-%S)-$RANDOM"
INSTALL_POSTHOG_API_KEY="phc_caJIOD8vW5727svQf90FNgdALIyYYouwEDEVh3BI1IH"

# Sends anonymous analytics event during installation
send_analytics_event() {
  event=$1
  if [ "$CLOUDYPAD_ANALYTICS_DISABLE" != "true" ]; then
    curl -s -o /dev/null -L --header "Content-Type: application/json" -d "{
      \"api_key\": \"$INSTALL_POSTHOG_API_KEY\",
      \"event\": \"$event\",
      \"distinct_id\": \"$INSTALL_POSTHOG_DISTINCT_ID\",
      \"properties\": {
        \"\$process_person_profile\": false,
        \"os_name\": \"$(uname -s)\",
        \"os_arch\": \"$(uname -m)\"
      }
    }" https://eu.i.posthog.com/capture/
  fi
}

send_analytics_event "cli_install_start"

echo "Installing Cloudy Pad version $CLOUDYPAD_SCRIPT_REF"

CLOUDYPAD_SCRIPT_URL="https://raw.githubusercontent.com/PierreBeucher/cloudypad/$CLOUDYPAD_SCRIPT_REF/cloudypad.sh"
# ===

# Constants, do not override
INSTALL_DIR="$CLOUDYPAD_HOME/bin"
SCRIPT_NAME="cloudypad"
SCRIPT_PATH="$INSTALL_DIR/cloudypad"

# Check if cloudypad is already in PATH
if [ -n "$(which cloudypad)" ]; then
  CURRENT_CLOUDYPAD_PATH=$(which cloudypad)

  # Read from /dev/tty to ensure read will work even if script is piped to shell such as install.sh | sh
  read -p "cloudypad is already installed at ${CURRENT_CLOUDYPAD_PATH}. Do you want to overwrite it? (y/N): " CONFIRM < /dev/tty

  if [[ "$CONFIRM" != "y" ]]; then
    echo "Installation aborted."
    exit 1
  fi
fi

if [ "$CLOUDYPAD_INSTALL_SKIP_DOCKER_CHECK" != "true" ]; then

  # Check if Docker is installed and usable
  if ! docker --version > /dev/null; then
    echo "Docker is not installed or running 'docker --version' failed. Please make sure you have a working Docker installation. See https://docs.docker.com/engine/install/"
    exit 1
  fi

  # Check if Docker daemon is accessible
  if ! docker info > /dev/null; then
    echo "Docker is installed but not usable. Have you added yourself to docker group? See https://docs.docker.com/engine/install/linux-postinstall/"
    echo "You might need to run 'sudo usermod -aG docker \$USER' and restart your logout / log back before being able to use Docker"
    exit 1
  fi
fi

# Create secure directory for Cloudy Pad home as it may contain sensitive data
mkdir -p "$CLOUDYPAD_HOME"
chmod 0700 $CLOUDYPAD_HOME

mkdir -p "$INSTALL_DIR"

echo "Downloading $CLOUDYPAD_SCRIPT_URL..."

if command -v curl >/dev/null 2>&1; then
  curl --fail -sSL -o "$SCRIPT_PATH" "$CLOUDYPAD_SCRIPT_URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$SCRIPT_PATH" "$CLOUDYPAD_SCRIPT_URL"
else
  echo "Error: Neither curl nor wget is available to download Cloudy Pad. Please install wget or curl and try again."
  exit 1
fi

chmod +x "$SCRIPT_PATH"

echo "Downloading Cloudy Pad container images..."

$SCRIPT_PATH download-container-images

# Identify shell to update *.rc file with PATH update
SHELL_NAME=$(basename "${SHELL}")
STARTUP_FILE=""

case "${SHELL_NAME}" in
    "bash")
        # Terminal.app on macOS prefers .bash_profile to .bashrc, so we prefer that
        # file when trying to put our export into a profile. On *NIX, .bashrc is
        # preferred as it is sourced for new interactive shells.
        if [ "$(uname)" != "Darwin" ]; then
            if [ -e "${HOME}/.bashrc" ]; then
                STARTUP_FILE="${HOME}/.bashrc"
            elif [ -e "${HOME}/.bash_profile" ]; then
                STARTUP_FILE="${HOME}/.bash_profile"
            fi
        else
            if [ -e "${HOME}/.bash_profile" ]; then
                STARTUP_FILE="${HOME}/.bash_profile"
            elif [ -e "${HOME}/.bashrc" ]; then
                STARTUP_FILE="${HOME}/.bashrc"
            fi
        fi
        ;;
    "zsh")
        STARTUP_FILE="${ZDOTDIR:-$HOME}/.zshrc"
        ;;
    *)
        echo
        echo "WARNING: Couldn't identify startup file to use (such as .bashrc or .zshrc) for your current shell."
        echo "         Detected shell from \$SHELL=$SHELL environment variable: '$SHELL_NAME'"
        echo "         To finalize installation please ensure $INSTALL_DIR is on your \$PATH"
        echo "         Otherwise you may not be able to run Cloudy Pad CLI."
        echo "         Alternatively, use directly $SCRIPT_PATH to run Cloudy Pad CLI."
        echo "         If you think this is a bug, please create an issue: https://github.com/PierreBeucher/cloudypad/issues"
        ;;
esac

if [ -n "${STARTUP_FILE}" ]; then
    # Create startup file if it does not exists. Rare situation but may happen
    touch "${STARTUP_FILE}"

    LINE_TO_ADD="export PATH=\$PATH:${INSTALL_DIR}"
    if ! grep -q "# add CloudyPad CLI PATH" "${STARTUP_FILE}"; then
        echo "Adding ${INSTALL_DIR} to \$PATH in ${STARTUP_FILE}"
        printf "\\n# add CloudyPad CLI PATH\\n%s\\n\\n" "${LINE_TO_ADD}" >> "${STARTUP_FILE}"
    fi

    echo "Successfully installed Cloudy Pad 🥳"
    echo
    echo "Restart your shell to add cloudypad on your PATH or run:"
    echo
    echo "  source $STARTUP_FILE"
    echo
fi

echo
echo "Get started by creating a Cloudy Pad instance:"
echo
echo "  cloudypad create"
echo 
echo "If you enjoy Cloudy Pad, please star us ⭐ https://github.com/PierreBeucher/cloudypad"
echo "🐛 Found a bug? Create an issue: https://github.com/PierreBeucher/cloudypad/issues"
echo

send_analytics_event "cli_install_finish"
