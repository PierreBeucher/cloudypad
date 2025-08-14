#!/usr/bin/env bash

#
# Detect NVIDIA GPU model name without relying on nvidia-smi
#
# GPU model is outputtued on stdout as either "display" or "datacenter"
# Everything else is stderr
#

set -e

# Fetch NVIDIA devices
# '10de' is the vendor ID for NVIDIA which we'll find on all NVIDIA GPUs
# such as line
# 01:00.0 3D controller [0302]: NVIDIA Corporation AD104GL [L4] [10de:27b8] (rev a1)
gpu_lines=$(lspci -nn | grep '10de:')

# Manual test
# gpu_lines=$(cat<<EOF
# 01:00.0 3D controller [0302]: NVIDIA Corporation AD104GL [RTX A5000] [10de:27b8] (rev a1)
# EOF
# )

if [ -z "$gpu_lines" ]; then
    echo "No NVIDIA GPU found. Defaulting to datacenter driver." >&2
    echo "datacenter"
    exit 0
fi

# Detect known NVIDIA GPU models
# Check for datacenter/Tesla GPUs first (including RTX A series)
# Then check for consumer/display GPUs (GeForce, GTX, RTX without A series)
if echo "$gpu_lines" | grep -Eiq '\b(L4|L40S?|A2|A10|A16|A30|A40|A100|H100|H200|B100|B200|Tesla|Quadro|T4|V100|P100|P40|P4|M40|K80|RTX A[0-9]+)\b'; then
  echo "datacenter"
elif echo "$gpu_lines" | grep -Eiq '\b(GeForce|GTX|RTX|MX)\b'; then
  echo "display"
else
  echo "Unknown NVIDIA GPU model for $gpu_lines." >&2
  echo "Defaulting to 'datacenter' driver." >&2
  
  echo "datacenter"
fi
