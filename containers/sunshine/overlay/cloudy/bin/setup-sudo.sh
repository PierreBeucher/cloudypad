#!/usr/bin/env bash

#
# Generate random password for cloudy user and add to sudoers
# with a proper lecture file
#

# Check if running as root
if [[ $(id -u) -ne 0 ]]; then
    echo "This script must be run as root" >&2
    exit 1
fi

echo "Creating password file for CLOUDYPAD_USER $CLOUDYPAD_USER"

# Keep password file in data folder to ensure it persists across container restarts
CLOUDY_PASSWORD_DIR="${XDG_DATA_HOME}/cloudypad/sudo"
CLOUDY_PASSWORD_FILE="${CLOUDY_PASSWORD_DIR}/password"

if [[ -f "${CLOUDY_PASSWORD_FILE}" ]]; then
    echo "Root password file already exists at ${CLOUDY_PASSWORD_FILE}"
    CLOUDY_PASSWORD=$(cat "${CLOUDY_PASSWORD_FILE}")
else
    # Create a secure password file for CLOUDYPAD_USER 
    # Will be used by get-cloudy-password command
    mkdir -p "${CLOUDY_PASSWORD_DIR}"
    touch "${CLOUDY_PASSWORD_FILE}"
    chown $CLOUDYPAD_USER:$CLOUDYPAD_USER "${CLOUDY_PASSWORD_FILE}"
    chmod 600 "${CLOUDY_PASSWORD_FILE}"

    # Generate random password and save to file
    CLOUDY_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-30)
    echo $CLOUDY_PASSWORD > "${CLOUDY_PASSWORD_FILE}"
fi

# Set password for CLOUDYPAD_USER
echo "cloudy:${CLOUDY_PASSWORD}" | chpasswd

# Set up sudo lecture file directory from template
SUDO_LECTURE_FILE="${XDG_CONFIG_HOME}/cloudypad/sudo/lecture_file.txt"
SUDO_LECTURE_TEMPLATE="${XDG_CONFIG_HOME}/cloudypad/sudo/lecture_file.template.txt"

echo "Copying sudo lecture file from template from ${SUDO_LECTURE_TEMPLATE} to ${SUDO_LECTURE_FILE}"

# Copy lecture file (secured for CLOUDYPAD_USER as it contains the password)
mkdir -p "${SUDO_LECTURE_DIR}"
touch "${SUDO_LECTURE_FILE}"
chmod 600 "${SUDO_LECTURE_FILE}"
chown $CLOUDYPAD_USER:$CLOUDYPAD_USER "${SUDO_LECTURE_FILE}"

CLOUDYPAD_USER_PASSWORD="${CLOUDY_PASSWORD}" envsubst < "${SUDO_LECTURE_TEMPLATE}" > "${SUDO_LECTURE_FILE}"

echo "Sudo lecture file with password has been created at ${SUDO_LECTURE_FILE}"

# Add cloudy user to sudoers with password prompt and lecture file
cat > /etc/sudoers.d/cloudy << EOF
cloudy ALL=(ALL) ALL
Defaults:cloudy lecture_file="${SUDO_LECTURE_FILE}"
Defaults:cloudy lecture = always
EOF
chmod 440 /etc/sudoers.d/cloudy

echo "Cloudy user has been added to sudoers with password prompt"