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
# Core commands
# These functions are called directly and check for parameters before using other sub-functions
#

CLOUDYPAD_INIT_CREATE='c'
CLOUDYPAD_INIT_USE_EXISTING='e'

# Initialize and configure a new instance
# Prompt user for cloud provider to use and whether or not an existing shall be used 
init() {
    
    local cloudypad_instance_name

    # If available, use CLOUDYPAD_INSTANCE env var or first arg before prompting user
    if [[ -n "$CLOUDYPAD_INSTANCE" || -n "$1" ]]; then
        cloudypad_instance_name=${CLOUDYPAD_INSTANCE:-$1}
    else
        cloudypad_instance_name_default="cloudypad-$(whoami)"
        read -p "How shall we name your Cloudy Pad instance? (default: $cloudypad_instance_name_default) " cloudypad_instance_name
        cloudypad_instance_name=${cloudypad_instance_name:-$cloudypad_instance_name_default}
    fi


    cloudypad_instance_name=${cloudypad_instance_name:-$cloudypad_instance_name_default}
    
    echo
    echo "Initializing Cloudy Pad instance '$cloudypad_instance_name'"

    local cloudypad_clouder=$(prompt_choice "Which cloud provider do you want to use?" ${cloudypad_supported_clouders[@]})

    echo
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
            echo "Invalid choice machine create or use existing choice '$machine_create_choice_user'. If you think this is a bug please file an issue." >&2
            exit 3
            ;;
    esac

    # Create/use existing machine and initialize Ansible inventory
    case "$cloudypad_clouder" in
        paperspace)
            init_paperspace $cloudypad_instance_name $machine_create_choice
            ;;
        aws)
            init_aws $cloudypad_instance_name $machine_create_choice
            ;;
        *)
            echo "Clouder $cloudypad_clouder is not supported. If you think this is a bug please file an issue." >&2
            exit 6
            ;;
    esac

    run_update_ansible $cloudypad_instance_name

    echo
    echo "🥳 Your Cloudy Pad instance is ready !"
    echo

    local pair_now_input
    read -p "Do you want to pair with Moonlight now? [Y/n] " pair_now_input

    # Default to 'Y' if the user presses Enter without typing anything
    pair_now_input=${pair_now_input:-Y}

    if [[ "$pair_now_input" =~ ^[Yy]$ ]]; then
        pair_moonlight $cloudypad_instance_name
    else
        echo
        echo "You can run"
        echo
        echo "  cloudypad pair $cloudypad_instance_name"
        echo 
        echo "or "
        echo
        echo "  cloudypad get $cloudypad_instance_name"
        echo
        echo "To pair your instance later"
    fi
}

update() {
    if [ $# -eq 0 ]; then
        echo >&2
        echo "Update requires at least 1 argument: instance to update" >&2
        echo "Use 'list' subcommand to see existing instances" >&2
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
        echo >&2
        echo "$cloudypad_instance_action requires at least 1 argument: instance name" >&2
        echo "Use 'list' subcommand to see existing instances" >&2
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

pair_moonlight() {
     if [ $# -eq 0 ]; then
        echo >&2
        echo "Pair requires exactly 1 argument: instance name to pair" >&2
        echo "Use 'list' subcommand to see existing instances" >&2
        exit 1
    fi

    local instance_name=$1
    local instance_hostname=$(get_cloudypad_instance_host $instance_name)

    echo
    echo "Please run Moonlight and add computer: '$instance_hostname'"
    echo
    echo "Once PIN is shown, press ENTER to continue to verification page."
    echo "(verification URL will be known after pairing is initialized by Moonlight)"
    echo
    read -p "Press ENTER to continue..."

    local pin_url=$(get_wolf_pin_url $instance_name)

    echo
    echo "Open URL to validate PIN: $pin_url"
    echo

}

ssh_instance(){
    if [ $# -eq 0 ]; then
        echo >&2
        echo "SSH requires exactly 1 argument: instance name to pair" >&2
        echo "Use 'list' subcommand to see existing instances" >&2
        exit 1
    fi

    local instance_name=$1
    local ssh_user="paperspace"
    local ssh_host="184.105.189.240"

    ssh $ssh_user@$ssh_host

}

#
# Sub-functions and utils
#

get_wolf_pin_url() {

    local instance_name=$1
    local instance_host="$(get_cloudypad_instance_host $instance_name)"
    local instance_user="$(get_cloudypad_instance_user $instance_name)"

    # Fetch latest "insert pin" URL in Wolf logs
    local pin_ssh_results=$(ssh $instance_user@$instance_host "sh -c 'docker logs wolf-wolf-1 2>&1 | grep -a \"Insert pin at\" | tail -n 1'")

    # Replace private hostname by public hostname
    local url_regex='(http://[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+/pin/#?[0-9A-F]+)'
    if [[ $pin_ssh_results =~ $url_regex ]]; then
        local url="${BASH_REMATCH[0]}"
        local replaced_url=$(echo "$url" | sed -E "s/[0-9]{1,3}(\.[0-9]{1,3}){3}/$instance_host/")
        echo "$replaced_url"
    else
        echo >&2
        echo "PIN validation URL not found in Wolf logs." >&2
        exit 1
    fi
}

check_instance_exists() {
    cloudypad_instance_name=$1
    cloudypad_instance_dir=$(get_cloudypad_instance_dir $cloudypad_instance_name)

    # Check if the inventory path exists
    if [ ! -d "$cloudypad_instance_dir" ]; then
        echo >&2
        echo "Error: Instance's directory not found: $cloudypad_instance_dir" >&2
        exit 1
    fi
}