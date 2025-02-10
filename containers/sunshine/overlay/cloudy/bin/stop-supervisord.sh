#!/usr/bin/env bash

# Force stop container by killing its own PID 1.
# PID 1 should be supervisord which will stop all services gracefully and shutdown
# effectively stopping the container.
# 
# This script it aimed to provide an "easy' way to stop Sunshine session since
# typing "CTRL+ALT+SHIFT+Q" is not easy for some user, allowing to have a shortcut on desktop pointing to this script.
# Container will probably restart instantly but that's expected

# send SIGTERM to supervisord for graceful shutdown
kill -SIGTERM 1
