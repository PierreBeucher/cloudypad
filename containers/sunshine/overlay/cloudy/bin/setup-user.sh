#!/usr/bin/env bash

#
# Setup runtime user with proper groups and permissions
# ensure it can access device so that controller, joystick, etc. will work
# 

# Add runtime user to these groups
user_groups=( video audio input pulse )

echo "Ensuring user $CLOUDYPAD_USER is in groups: ${user_groups[@]}"

for group in "${user_groups[@]}"; do
    if getent group "${group}" > /dev/null 2>&1; then
        echo "Ensuring user $CLOUDYPAD_USER in group: '${group}'"
        usermod -aG "${group}" "${CLOUDYPAD_USER}"
    fi
done

# Make sure runtime user is added to groups of device nodes
# Groups are created dynamically if they don't exist
# Inspired from https://github.com/Steam-Headless/docker-steam-headless/blob/14c770bce61db99c56592760c73c2ba454dab648/overlay/etc/cont-init.d/10-setup_user.sh
device_nodes=( /dev/uinput /dev/input/event* /dev/dri/* )
added_groups=""
for device in "${device_nodes[@]}"; do

    # Only consider character devices    
    if [[ ! -c "${device}" ]]; then
        continue
    fi

    device_group=$(stat -c "%G" "${device}")
    device_gid=$(stat -c "%g" "${device}")

    # Ignore root group to avoid adding user to root group
    if [[ "${device_gid}" = 0 ]]; then
        continue
    fi

    # Create group if it doesn't exist
    if [[ "${device_group}" = "UNKNOWN" ]]; then
        device_group="user-gid-${device_gid}"
        groupadd -g $device_gid "${device_group}"
    fi

    # Add user to group if not already added
    if [[ "${added_groups}" != *"${device_group}"* ]]; then
        echo "Adding user '${CLOUDYPAD_USER}' to group: '${device_group}' for device: ${device}"
        usermod -aG ${device_group} ${CLOUDYPAD_USER}
        added_groups=" ${added_groups} ${device_group} "
    fi
done
