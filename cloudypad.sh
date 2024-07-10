#!/usr/bin/env bash

# set -xe
set -e

usage() {
    echo "Usage: $0 {init|start|stop|restart|list|get}"
    exit 1
}

# TODO in user's home directory
cloudypad_home=$PWD/tmp/cloudypad_home

# Initialize a new instance
init() {
    
    # Initialize home directory
    mkdir -p $cloudypad_home

    cloudypad_instance_name_default="mycloudypad"
    read -p "How shall we name your Cloudy Pad instance? (default: $cloudypad_instance_name_default)" cloudypad_instance_name

    cloudypad_instance_name=${cloudypad_instance_name:-$cloudypad_instance_name_default}

    echo "Initializing Cloudy Pad instance '$cloudypad_instance_name'"

    # Other clouder may be supported
    cloudypad_clouder="paperspace" 
    case "$cloudypad_clouder" in
        paperspace)
            init_paperspace $cloudypad_instance_name
            ;;
        *)
            echo "Clouder $cloudypad_clouder is not supported."
            ;;
    esac
}

init_paperspace() {

    cloudypad_instance_name=$1

    check_paperspace_login

    pspace machine list

    # Check existing machines (TODO again, maybe we can optimize)
    # If only a single machine present, use it as default
    # Fetch the machine list and check if there's only one result
    machine_list=$(pspace machine list --json)
    machine_count=$(echo "$machine_list" | jq '.items | length')

    if [ "$machine_count" -eq 1 ]; then
        default_machine=$(echo "$machine_list" | jq -r '.items[0].id')
        read -p "Enter machine ID to use (default: $default_machine):" paperspace_machine_id
    else
        read -p "Enter machine ID to use:" paperspace_machine_id
    fi

    paperspace_machine_id=${paperspace_machine_id:-$default_machine}

    echo "Configuring Paperspace machine $paperspace_machine_id."

    paperspace_machine_json=$(pspace machine get $paperspace_machine_id --json)
    
    cloudypad_instance_host=$(echo $paperspace_machine_json | jq '.publicIp' -r)
    cloudypad_instance_user=paperspace

    mkdir -p $(get_cloudypad_instance_dir $cloudypad_instance_name)

    init_ansible_inventory $cloudypad_instance_name $cloudypad_instance_host $cloudypad_instance_user "paperspace" $paperspace_machine_id

    run_configuration_ansible $cloudypad_instance_name

    echo "Instance $cloudypad_instance_name has been initialized !"
    echo "You can now run moonlight and connect via host $cloudypad_instance_host"
}

# Check if paperspace CLI is logged-in
# A bit hacky as CLI does not provide a "choami" feature
check_paperspace_login () {
    pspace_team_config=$(pspace config get team)

    if [ "$pspace_team_config" == "null" ]; then
        echo "Please login to Paperspace..."
        pspace login
    fi
}

# Create an Ansible inventory for CloudyPad configuration
init_ansible_inventory() {

    cloudypad_instance_name=$1
    cloudypad_instance_host=$2
    cloudypad_instance_user=$3
    cloudypad_clouder=$4
    cloudypad_machine_id=$5

    ansible_inventory_path="$(get_cloudypad_instance_ansible_inventory_path $cloudypad_instance_name)"

    echo "Creating Ansible inventory for $cloudypad_instance_name in $ansible_inventory_path"

    cat << EOF > $ansible_inventory_path
all:
  hosts:
    "$cloudypad_instance_name":  # Machine ID in Clouder
      ansible_host: "$cloudypad_instance_host"
      ansible_user: "$cloudypad_instance_user"
  vars:
    cloudypad_clouder: $cloudypad_clouder
    cloudypad_machine_id: $cloudypad_machine_id
    ansible_python_interpreter: auto_silent
EOF

}

run_configuration_ansible() {
    cloudypad_instance_name=$1

    ansible_inventory=$(get_cloudypad_instance_ansible_inventory_path $cloudypad_instance_name)

    echo "Running Cloudy Pad configuration for $cloudypad_instance_name..."

    ansible-playbook -i $ansible_inventory ansible/playbook.yml
}

get_cloudypad_instance_dir() {
    cloudypad_instance_name=$1
    echo "$cloudypad_home/instances/$cloudypad_instance_name"
}

get_cloudypad_instance_ansible_inventory_path(){
    cloudypad_instance_name=$1
    echo "$(get_cloudypad_instance_dir $cloudypad_instance_name)/ansible-inventory"
}

check_instance_exists() {
    cloudypad_instance_name=$1
    cloudypad_instance_dir=$(get_cloudypad_instance_dir $cloudypad_instance_name)

    # Check if the inventory path exists
    if [ ! -d "$cloudypad_instance_dir" ]; then
        echo "Error: Instance's directory not found: $cloudypad_instance_dir"
        exit 1
    fi
}


configure() {
    if [ $# -eq 0 ]; then
        echo "Configure requires at least 1 argument: instance to configure"
        echo "Use 'list' subcommand to see existing instances"
        exit 1
    fi

    cloudypad_instance_name=$1
    run_configuration_ansible $cloudypad_instance_name
}

start() {
    if [ $# -eq 0 ]; then
        echo "Start requires at least 1 argument: instance to start"
        echo "Use 'list' subcommand to see existing instances"
        exit 1
    fi

    instance_stop_start_restart_get start $1
}

start() {
    if [ $# -eq 0 ]; then
        echo "Stop requires at least 1 argument: instance to stop"
        echo "Use 'list' subcommand to see existing instances"
        exit 1
    fi

    instance_stop_start_restart_get stop $1
}

restart() {


    instance_stop_start_restart_get restart $1
}

instance_stop_start_restart_get() {
    cloudypad_instance_action=$1
    cloudypad_instance_name=$2

    if [ -z "$cloudypad_instance_name" ]; then
        echo "$cloudypad_instance_action requires at least 1 argument: instance name"
        echo "Use 'list' subcommand to see existing instances"
        exit 1
    fi

    echo "$cloudypad_instance_name: $cloudypad_instance_action"

    check_instance_exists $cloudypad_instance_name

    inventory_path=$(get_cloudypad_instance_ansible_inventory_path $cloudypad_instance_name)

    cloudypad_clouder=$(cat $inventory_path | yq .all.vars.cloudypad_clouder -r)
    cloudypad_machine_id=$(cat $inventory_path | yq .all.vars.cloudypad_machine_id -r)

    case "$cloudypad_clouder" in
        paperspace)
            paperspace_machine_action $cloudypad_instance_action $cloudypad_machine_id
            ;;
        *)
            echo "Clouder $cloudypad_clouder is not supported."
            ;;
    esac
}

paperspace_machine_action() {
    pspace_action=$1
    pspace_machine=$2

    echo "Paperspace: $pspace_action $pspace_machine"
    pspace machine $pspace_action $pspace_machine
}

# List all instances 
list() {

    # Simply list existing directories in instances directories
    # Naive but sufficient for now
    find $cloudypad_home/instances -mindepth 1 -maxdepth 1 -type d -exec basename {} \;
}

# Check if a subcommand is provided
if [ $# -eq 0 ]; then
    usage
fi

# Execute the appropriate function based on the subcommand
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
    configure)
        configure "${@:2}"
        ;;
    *)
        usage
        ;;
esac