#
# Variable and setup
#
cloudypad_home=${CLOUDYPAD_HOME:-$HOME/.cloudypad}
mkdir -p $cloudypad_home
mkdir -p $cloudypad_home/instances

cloudypad_supported_clouders=("aws" "paperspace")

# Pulumi setup
# Use local file Pulumi backend for ease of use
export PULUMI_BACKEND_URL=${PULUMI_BACKEND_URL:-"file://$cloudypad_home/pulumi-backend"}
export PULUMI_CONFIG_PASSPHRASE=${PULUMI_CONFIG_PASSPHRASE:-""}
CLOUDYPAD_PULUMI_STACK_CONFIG_DIR="$cloudypad_home/pulumi-stack-configs" # not a Pulumi built-in, passed as flag to commands

# Ensure backend and stack config dir exists
mkdir -p $cloudypad_home/pulumi-backend
mkdir -p $CLOUDYPAD_PULUMI_STACK_CONFIG_DIR

#
# Utils
#

# Prompt user for a choice
prompt_choice() {
    prompt=$1
    options=("${@:2}")

    # If possible show most options on screen with max 10
    fzf_length=$((${#options[@]} + 3))
    [ $fzf_length -gt 10 ] && fzf_length=10

    echo "" >&2
    echo "$prompt" >&2

    choice=$(printf "%s\n" "${options[@]}" | fzf --height $fzf_length)
    echo "$choice"
}

#
# Core
#

# Initialize and configure a new instance
# Prompt user for cloud provider to use and whether or not an existing shall be used 
init() {

    # Initialize home directory
    mkdir -p $cloudypad_home

    local cloudypad_instance_name
    # If available, use CLOUDYPAD_INSTANCE env var or first arg before prompting user
    if [[ -n "$CLOUDYPAD_INSTANCE" || -n "$1" ]]; then
        cloudypad_instance_name=${CLOUDYPAD_INSTANCE:-$1}
    else
        cloudypad_instance_name_default="mycloudypad"
        read -p "How shall we name your Cloudy Pad instance? (default: $cloudypad_instance_name_default) " cloudypad_instance_name
        cloudypad_instance_name=${cloudypad_instance_name:-$cloudypad_instance_name_default}
    fi

    cloudypad_instance_name=${cloudypad_instance_name:-$cloudypad_instance_name_default}
    echo "Initializing Cloudy Pad instance '$cloudypad_instance_name'"

    local cloudypad_clouder=$(prompt_choice "Which cloud provider do you want to use?" ${cloudypad_supported_clouders[@]})

    echo "Using provider: $cloudypad_clouder"

    echo
    echo "To initialize your CloudyPad instance we need a machine in the Cloud."
    echo "CloudyPad can use an existing machine or create one for you:"
    echo " - I can create a machine quickly with sane default and security configuration 🚀 (you'll be prompted for a few configs)"
    echo " - You can create your own instance and give me its ID. It will let you customize more elements but requires advanced knowledge 🧠"

    local machine_create_choice
    local machine_choice_create="Create a machine for me"
    local machine_choice_use_existing="I'll bring my own machine"
    machine_create_choice_user=$(prompt_choice "Create a machine or use existing one?" "$machine_choice_create" "$machine_choice_use_existing")

    case "$machine_create_choice_user" in
        "$machine_choice_create")
            echo
            echo "Sure, let's create a new machine!"
            machine_create_choice=$CLOUDYPAD_INIT_CREATE
            ;;
        "$machine_choice_use_existing")
            echo
            echo "Sure, let's use an existing machine!"
            machine_create_choice=$CLOUDYPAD_INIT_USE_EXISTING
            ;;
        *)
            echo "Invalid choice machine create or use existing choice '$machine_create_choice_user'. This is probably a bug, please file an issue."
            exit 3
            ;;
    esac

    # Other clouder may be supported
    case "$cloudypad_clouder" in
        paperspace)
            init_paperspace $cloudypad_instance_name $machine_create_choice
            ;;
        aws)
            init_aws $cloudypad_instance_name $machine_create_choice
            ;;
        *)
            echo "Clouder $cloudypad_clouder is not supported. This is probably a bug, please file an issue."
            exit 6
            ;;
    esac
}

CLOUDYPAD_INIT_CREATE='c'
CLOUDYPAD_INIT_USE_EXISTING='e'

init_create_machine() {
    cloudypad_clouder=$1
    echo "Would create $cloudypad_clouder machine" # TODO
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

update() {
    if [ $# -eq 0 ]; then
        echo "Update requires at least 1 argument: instance to update"
        echo "Use 'list' subcommand to see existing instances"
        exit 1
    fi

    cloudypad_instance_name=$1
    run_update_ansible $cloudypad_instance_name
}

list() {
    # Simply list existing directories in instances directories
    # Naive but sufficient for now
    find $cloudypad_home/instances -mindepth 1 -maxdepth 1 -type d -exec basename {} \;
}

instance_stop_start_restart_get() {
    cloudypad_instance_action=$1
    cloudypad_instance_name=$2

    if [ -z "$cloudypad_instance_name" ]; then
        echo "$cloudypad_instance_action requires at least 1 argument: instance name"
        echo "Use 'list' subcommand to see existing instances"
        exit 1
    fi

    check_instance_exists $cloudypad_instance_name

    inventory_path=$(get_cloudypad_instance_ansible_inventory_path $cloudypad_instance_name)

    cloudypad_clouder=$(cat $inventory_path | yq .all.vars.cloudypad_clouder -r)
    cloudypad_machine_id=$(cat $inventory_path | yq .all.vars.cloudypad_machine_id -r)

    case "$cloudypad_clouder" in
        paperspace)
            paperspace_machine_action $cloudypad_instance_action $cloudypad_machine_id
            ;;
        aws)
            aws_machine_action $cloudypad_instance_action $cloudypad_machine_id
            ;;
        *)
            echo "Clouder $cloudypad_clouder is not supported."
            ;;
    esac
}

