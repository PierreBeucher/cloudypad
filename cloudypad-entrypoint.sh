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
    echo "Usage: cloudypad {init|update|start|stop|restart|get|list|pair|ssh|debug-container}"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

case "$1" in
    init)
        init "${@:2}"
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
    pair)
        pair_moonlight "${@:2}"
        ;;
    debug-container)
        bash
        ;;
    ssh)
        ssh_instance "${@:2}"
        ;;
    *)
        usage
        ;;
esac