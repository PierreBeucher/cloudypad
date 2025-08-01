# Heroic config is saved under $HOME and $XDG_CONFIG_HOME
# Ensure required directories exist and are usable by Cloudy user
# as these directories are designed to be mounted from host, we need to ensure they exist and are usable by Cloudy user
# since container runtime like Docker would typically mount them with root:root ownership and unwanted permissions
mkdir -p $XDG_CONFIG_HOME/heroic
chown $CLOUDYPAD_USER:$CLOUDYPAD_USER $XDG_CONFIG_HOME/heroic
chmod 0700 $XDG_CONFIG_HOME/heroic

mkdir -p $XDG_DATA_HOME/heroic
chown $CLOUDYPAD_USER:$CLOUDYPAD_USER $XDG_DATA_HOME/heroic
chmod 0700 $XDG_DATA_HOME/heroic