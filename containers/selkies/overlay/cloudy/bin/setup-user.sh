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
device_nodes=( /dev/input/event* /dev/input/js* /dev/uinput /dev/dri/* )
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

    if id -nG "${CLOUDYPAD_USER}" | grep -qw "${device_group}"; then
        echo "User '${CLOUDYPAD_USER}' is already in group: '${device_group}'"
    else 
        echo "Adding user '${CLOUDYPAD_USER}' to group: '${device_group}' for device: ${device}"
        usermod -aG ${device_group} ${CLOUDYPAD_USER}
    fi
done
