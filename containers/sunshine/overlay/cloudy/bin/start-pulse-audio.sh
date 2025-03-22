#!/usr/bin/env bash

# pulseaudio will quit when idle but it somehow prevent Sunshine streaming from working
# ensure it keeps running with exit-idle-time=-1
pulseaudio --log-target=stderr --log-time --exit-idle-time=-1