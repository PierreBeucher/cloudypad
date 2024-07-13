#!/usr/bin/env bash

#
# CloudyPad core script to manage and configure instances.
# THIS IS A POC SCRIPT IN SHELL FORMAT. It will probably be rewritten using Typescript or Python
# though interface shall remain roughly the same.
#

set -e

source cli-sh/core.sh
source cli-sh/ansible.sh
source cli-sh/aws.sh
source cli-sh/paperspace.sh

usage() {
    echo "Usage: $0 {init|update|start|stop|restart|get|list}"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

case "$1" in
    init)
        init
        ;;
    start)
        instance_stop_start_restart_get "${@:1}"
        ;;
    stop)
        instance_stop_start_restart_get "${@:1}"
        ;;
    restart)
        instance_stop_start_restart_get "${@:1}"
        ;;
    get)
        instance_stop_start_restart_get "${@:1}"
        ;;
    list)
        list
        ;;
    update)
        update "${@:2}"
        ;;
    *)
        usage
        ;;
esac