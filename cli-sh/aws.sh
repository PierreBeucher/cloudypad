init_aws() {

    local cloudypad_instance_name=$1
    local cloudypad_machine_choice=$2

    check_aws_login

    local aws_instance_id
    local cloudypad_instance_user

    case "$cloudypad_machine_choice" in

        # Prompt user for an existing machine to use
        "$CLOUDYPAD_INIT_USE_EXISTING")
            aws ec2 describe-instances --query 'Reservations[*].Instances[*].{Name: Tags[?Key==`Name`].Value | [0], InstanceId: InstanceId, PublicIpAddress: PublicIpAddress, State: State.Name}' --output table

            # Fetch the instance list
            local instance_list=$(aws ec2 describe-instances --query 'Reservations[*].Instances[*].InstanceId' --output json | jq -r '.[][]')
            local instance_count=$(echo "$instance_list" | wc -l)

            if [ "$instance_count" -eq 1 ]; then
                echo "No AWS EC2 instance found. Are you using the correct profile or region ?"
                echo "If needed, set profile or region with:"
                echo "  export AWS_PROFILE=myprofile"
                echo "  export AWS_REGION=eu-central-1"
                exit 7
            fi

            local aws_instance_id=$(prompt_choice "Chose an instance:" $instance_list)
            
            read -p "Which user to connect with via SSH ? (eg. 'ec2-user', 'ubuntu', ...): " cloudypad_instance_user
            
            ;;
        "$CLOUDYPAD_INIT_CREATE")
            init_aws_create_instance $cloudypad_instance_name
            aws_instance_id=$(aws_get_instance_id $cloudypad_instance_name)
            cloudypad_instance_user="ubuntu"
            ;;
        *)
            echo "Unknown AWS instance selection type $cloudypad_machine_choice. This is probably a bug, please report it."
            exit 5
            ;;
    esac

    local aws_instance_json=$(aws ec2 describe-instances --instance-ids $aws_instance_id --query 'Reservations[*].Instances[*]' --output json)
    local cloudypad_instance_host=$(echo $aws_instance_json | jq -r '.[0][0].PublicIpAddress')

    if [ -z "$cloudypad_instance_host" ] || [ "$cloudypad_instance_host" == "null" ]; then
        echo "Error: Instance $aws_instance_id does not have a valid public IP address."
        exit 8
    fi

    echo "You're going to configure Cloudy Pad on AWS EC2:"
    echo "  Instance ID: $aws_instance_id"
    echo "  Hostname: $cloudypad_instance_host"
    echo "  SSH user: $cloudypad_instance_user"
    echo
    echo "Please note:"
    echo " - Setup may take some time, especially GPU driver installation."
    echo " - Machine may reboot several time during process, this is expected and should not cause error."
    echo " - You may be prompted multiple time to validate SSH key fingerprint."

    read -p "Do you want to continue? (y/N): " aws_install_confirm

    if [[ "$aws_install_confirm" != "y" && "$aws_install_confirm" != "Y" ]]; then
        echo "Aborting configuration."
        exit 0
    fi

    mkdir -p $(get_cloudypad_instance_dir $cloudypad_instance_name)

    init_ansible_inventory $cloudypad_instance_name $cloudypad_instance_host $cloudypad_instance_user "aws" $aws_instance_id

    run_update_ansible $cloudypad_instance_name

    echo "Instance $cloudypad_instance_name has been initialized!"
    echo "You can now run moonlight and connect via host $cloudypad_instance_host"
}

init_aws_create_instance() {
    local cloudypad_instance_name=$1

    local current_region=${AWS_REGION:-$(aws configure get region)}
    local aws_region
    read -p "Enter AWS region (default: $current_region): " aws_region
    aws_region=${aws_region:-$current_region}

    local instance_types=("g4dn.xlarge" "g4dn.2xlarge" "g4dn.4xlarge" "g4dn.8xlarge" "g5.xlarge" "g5.2xlarge" "g5.4xlarge" "g5.8xlarge")
    local aws_instance_type=$(prompt_choice "Choose an instance type" "${instance_types[@]}")

    local local_keys=($(ls ~/.ssh/*.pub 2>/dev/null))
    local aws_keys=($(aws ec2 describe-key-pairs --query 'KeyPairs[*].KeyName' --output text))
    local ssh_key_choices=("${local_keys[@]}" "${aws_keys[@]}")
    local ssh_key_choice=$(prompt_choice "Choose an SSH key (local or AWS)" "${ssh_key_choices[@]}")

    local key_type
    local ssh_key_name
    local ssh_public_key
    if [[ " ${local_keys[@]} " =~ " ${ssh_key_choice} " ]]; then
        key_type="local"
        ssh_key_name=$(basename "$ssh_key_choice" .pub)
        ssh_public_key=$(cat "$ssh_key_choice")
    else
        key_type="aws"
        ssh_key_name=$ssh_key_choice
    fi

    local root_volume_size
    read -p "Enter root volume size in GB (default: 100): " root_volume_size
    root_volume_size=${root_volume_size:-100}

    local ip_type_choice=$(prompt_choice "Use static Elastic IP or dynamic IP? (default: static)" "static" "dynamic")
    ip_type_choice=${ip_type_choice:-"static"}

    # Create stack if not exists and configure it
    pulumi -C pulumi/aws -s $cloudypad_instance_name stack select --create

    local pulumi_stack_config_path="$CLOUDYPAD_PULUMI_STACK_CONFIG_DIR/$cloudypad_instance_name.json"
    pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path config set aws:region $aws_region
    pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path config set cloudypad-aws:instanceType $aws_instance_type
    pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path config set cloudypad-aws:rootVolumeSizeGB $root_volume_size
    pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path config set cloudypad-aws:publicIpType $ip_type_choice

    if [[ "$key_type" == "local" ]]; then
        pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path config set cloudypad-aws:sshPublicKeyValue "$ssh_public_key"
    elif [[ "$key_type" == "aws" ]]; then
        pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path config set cloudypad-aws:existingKeyPair "$ssh_key_name"
    else
        echo "Unknown keypair type '$key_type'. This is probably a bug, please report it."
    fi

    echo "About to create an AWS EC2 instance with the following configuration:"
    echo "  Region: $aws_region"
    echo "  Instance Type: $aws_instance_type"
    if [[ "$key_type" == "local" ]]; then
        echo "  SSH Public Key: $ssh_public_key"
    else
        echo "  Existing AWS Key Pair: $ssh_key_name"
    fi
    echo "  Root Volume Size: $root_volume_size GB"
    echo "  IP Type: $ip_type_choice"

    echo 
    echo "Previewing instance creation..."
    
    pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path preview -r

    echo
    echo "Be aware that you'll be billed for instance usage. Remember to turn it of when unused or terminate it when you won't use it anymore!"
    echo

    local aws_create_confirm
    read -p "Continue? (y/N): " aws_create_confirm
    if [[ "$aws_create_confirm" != "y" && "$aws_create_confirm" != "Y" ]]; then
        echo "Aborting AWS instance creation."
        exit 8
    fi

    pulumi -C pulumi/aws -s $cloudypad_instance_name --config-file $pulumi_stack_config_path up -yrf
}

aws_get_instance_id() {
    local cloudypad_instance_name=$1
    pulumi -C pulumi/aws -s $cloudypad_instance_name stack output instanceId
}

check_aws_login() {
    aws sts get-caller-identity > /dev/null
    if [ $? -ne 0 ]; then
        echo "Please configure your AWS CLI with valid credentials."
        exit 1
    fi
}

aws_machine_action() {
    local aws_action=$1
    local aws_instance_id=$2

    case $aws_action in
        start)
            aws ec2 start-instances --instance-ids $aws_instance_id
            ;;
        stop)
            aws ec2 stop-instances --instance-ids $aws_instance_id
            ;;
        restart)
            aws ec2 reboot-instances --instance-ids $aws_instance_id
            ;;
        get)
            aws ec2 describe-instances --instance-ids $aws_instance_id
            ;;
        *)
            echo "Invalid action '$aws_action'. Use start, stop, restart, or status."
            ;;
    esac
}
