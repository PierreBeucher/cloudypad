#!/usr/bin/env bash
#
# Ensure /dev/nvidia-caps/* devices are present
# Used by nvidia-setup-caps service to ensure MIG devices are present on boot which is not always the case (eg. AWS G5 instance)
# See https://docs.nvidia.com/datacenter/tesla/mig-user-guide/index.html#device-nodes-devfs
echo "Running nvidia-modprobe to ensure /dev/nvidia-caps/* existence"
nvidia-modprobe -f /proc/driver/nvidia/capabilities/mig/config -f /proc/driver/nvidia/capabilities/mig/monitor

if [ $? -ne 0 ]; then
  echo "Error: nvidia-modprobe command failed. Could not ensure /dev/nvidia-caps/* existence" >&2
  exit 1
fi
