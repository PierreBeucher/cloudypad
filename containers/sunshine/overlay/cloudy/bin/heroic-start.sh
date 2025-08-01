#!/usr/bin/env bash

# 
# Start Heroic Games Launcher after setting up default config if needed:
# - If not config file exists, copy default config to use GE-Proton by default
# - If default GE-Proton version does not exist, download and extract it
#
# Setting-up such default config ensures user won't have to do (too much) technical stuff
# to start playing.
#

wait-x-availability.sh

echo "Preparing to start Heroic Games Launcher with args: $@"

# Copy default Heroic config if not already present
if [ ! -f $XDG_CONFIG_HOME/heroic/config.json ]; then
    echo "Copying default Heroic config from $CLOUDYPAD_CONF_DIR/heroic-default/config.json to $XDG_CONFIG_HOME/heroic/config.json"
    
    mkdir -p $XDG_CONFIG_HOME/heroic

    # default config is a template with env vars
    envsubst < $CLOUDYPAD_CONF_DIR/heroic-default/config.json > $XDG_CONFIG_HOME/heroic/config.json
    chmod 0644 $XDG_CONFIG_HOME/heroic/config.json
else 
    echo "Heroic config already exists in $XDG_CONFIG_HOME/heroic/config.json"
fi

# Check if default GE-Proton version exists and install if if needed
if [ ! -d "$XDG_CONFIG_HOME/heroic/tools/proton/$CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION" ]; then
    echo "Downloading GE-Proton version '$CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION'"
    curl -L -o /tmp/proton-ge.tar.gz https://github.com/GloriousEggroll/proton-ge-custom/releases/download/$CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION/$CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION.tar.gz

    mkdir -p $XDG_CONFIG_HOME/heroic/tools/proton
    tar -xzf /tmp/proton-ge.tar.gz -C $XDG_CONFIG_HOME/heroic/tools/proton
    rm /tmp/proton-ge.tar.gz
else 
    echo "Default GE-Proton version '$CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION' already exists in '$XDG_CONFIG_HOME/heroic/tools/proton/$CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION/proton'"
fi

echo "Starting Heroic Games Launcher with args: $@"

heroic "$@" &

HEROIC_PID=$!
echo $HEROIC_PID > /tmp/heroic.pid
echo "Heroic Games Launcher started with PID: $HEROIC_PID"

wait $HEROIC_PID