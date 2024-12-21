#!/usr/bin/env bash

# Demo using recorded command outputs for provision / configuration
# and live actions for Moonlight streaming
# 
# To update:
# - Record commands:
#       asciinema rec --overwrite create.cast -c 'npx tsx src/index.ts create aws'
# - Truncate beginning if needed
#       cat create.cast | { read; echo "$REPLY"; jq -c '.[0]=.[0]-4.2'; } > create-final.cast
# - Convert webm into Gif with:
#       ffmpeg -i demo.webm -vf "fps=15,scale=800:-1:flags=lanczos" -c:v pam -f image2pipe - | convert -delay 6 -layers Optimize -loop 0 - demo.gif
#

cloudypad(){
    # Use locally compiled Cloudy Pad
    node dist/src/index.js $@
}

moonlight(){
    # Not verbose to keep command history in demo
    flatpak run com.moonlight_stream.Moonlight > /dev/null 2>&1
}

script_dir="$(dirname $0)"

# Use demo magic
. "$script_dir/demo-magic.sh"

clear
wait

p "# Let's create our instance on AWS 🚀"
p "cloudypad create aws"
asciinema play $script_dir/1-input.cast -s 2
asciinema play $script_dir/2-provision.cast -s 4
sleep 1
asciinema play  $script_dir/3-config-1.cast -s 2

echo
p "# [...] Initial configuration takes ~5 min... ⏱️"
sleep 1

asciinema play $script_dir/4-config-2.cast -s 100

# Live demo for Moonlight streaming
# pair command actually ran as part of create, use directly for live demo
cloudypad pair my-instance
echo

wait

p "# Time to play! Run Moonlight and enjoy 🎮"
p "# Of course we'll need to install our games first."
p "# Once installed, games can be launched in a few seconds"
echo

moonlight

p "# Stop our instance when done playing..."
p "cloudypad stop my-instance"
sleep 1
echo "Stopped instance my-instance"
echo

p "# ... and start it again the next day!"
p "cloudypad start my-instance"
sleep 1
echo "Started instance my-instance"
echo

p "# What's my instance name already?"
p "cloudypad list"
asciinema play $script_dir/5-list.cast
echo

p "# Destroy our instance if we don't need it anymore."
p "cloudypad destroy my-instance"
asciinema play $script_dir/6-destroy.cast -s 2

wait