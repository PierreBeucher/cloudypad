#!/usr/bin/env bash

# Some required /dev/nvidia* files may not be created on boot
# Running a few command in user space cause them to appear
# This script is configured as a service to be run at boot time to ensure every needed nvidia devices are created properly

# Ensure /dev/nvidia-caps/* devices are present
# Used by nvidia-setup-caps service to ensure MIG devices are present on boot which is not always the case (eg. AWS G5 instance)
# See https://docs.nvidia.com/datacenter/tesla/mig-user-guide/index.html#device-nodes-devfs
echo "Running nvidia-modprobe to ensure /dev/nvidia-caps/* existence"
nvidia-modprobe -f /proc/driver/nvidia/capabilities/mig/config -f /proc/driver/nvidia/capabilities/mig/monitor

if [ $? -ne 0 ]; then
  echo "Error: nvidia-modprobe command failed. Could not ensure /dev/nvidia-caps/* existence" >&2
  exit 1
fi

echo "Ensuring other NVIDIA devices are loaded"

# /dev/nvidia-modeset
mknod /dev/nvidia-modeset c 195 254

# other /dev/nvidia* devices
# /dev/nvidia-uvm
# /dev/nvidia-uvm-tools
# /dev/nvidia0
# /dev/nvidiactl
nvidia-smi