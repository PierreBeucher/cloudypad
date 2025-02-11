#!/usr/bin/env bash

# Can be used by user to stop session

gnome-terminal -- bash -c "echo 'Shutting down... Your session will end in a few seconds.'; \
    echo 'You can also press CTRL+ALT+SHIFT+Q to exit session.'; \
    sleep 999"

sudo /cloudy/bin/stop-supervisord.sh