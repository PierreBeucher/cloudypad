init_paperspace() {

    cloudypad_instance_name=$1
    cloudypad_machine_choice=$2

    check_paperspace_login

    local paperspace_machine_id

    case "$cloudypad_machine_choice" in

        # Prompt user for an existing machine to use
        "$CLOUDYPAD_INIT_USE_EXISTING")
            pspace machine list

            # Check existing machines (TODO again, maybe we can optimize)
            # If only a single machine present, use it as default
            # Fetch the machine list and check if there's only one result
            local machine_list=$(pspace machine list --json | jq .items[].id -r)

            if [ -z "$machine_list" ]; then
                echo "No Paperspace machine found."
                exit 7
            fi

            local paperspace_machine_id=$(prompt_choice "Choose a machine" $machine_list)
            
            ;;
        "$CLOUDYPAD_INIT_CREATE")
            
            # Static machine types for now
            # Most machines are not suitable for gaming usage (eg. CPU or bery expansive multi-GPU)
            paperspace_machine_types_path="resources/paperspace/machine-types.json"
            paperspace_machine_types=$(cat $paperspace_machine_types_path)
            
            echo "Known machine types and pricing:"
            cat $paperspace_machine_types_path | jq -r '.[] | ["\(.type)", "\(.desc)", "\(.pricing)"] | @tsv' | column -t -s $'\t' -N "Type,Description,Pricing"

            local pspace_machine_type=$(prompt_choice "Choose a machine type (recommended: 'P5000')" $(cat $paperspace_machine_types_path |  jq -r '.[] | .type' | paste -sd ' ' -))
            
            
            # Create an Ubuntu 22.04 based on public template "t0nspur5"
            # All Ubuntu templates can be listed with 
            # $ pspace os-template list -j | jq '.items[] | select(.agentType == "LinuxHeadless" and (.operatingSystemLabel | tostring | contains("Ubuntu")))'
            local pspace_os_template="t0nspur5"
            
            local pspace_public_ip_type=$(prompt_choice "Enter public IP type (recommended: static)" "static" "dynamic")

            # Fetch available regions from JSON file
            available_regions=$(cat resources/paperspace/regions.json)

            echo "Available regions:"
            echo "$available_regions" | jq -r '.[] | "\(.desc)"'

            local pspace_region=$(prompt_choice "Choose a Paperspace region" $(echo "$available_regions" | jq -r '.[] | .code' | paste -sd ' ' -))

            read -p "Enter disk size (GB) (default: 100) " pspace_disk_size
            local pspace_disk_size=${pspace_disk_size:-100}
            
            echo "About to create Paperspace machine:"
            echo "  Machine name: 'CloudyPad - $cloudypad_instance_name'"
            echo "  Disk Size: ${pspace_disk_size}GB"
            echo "  Public IP Type: $pspace_public_ip_type"
            echo "  Region: $pspace_region"
            echo "  OS Template: $pspace_os_template (Ubuntu 22.04)"
            echo "  Machine Type: $pspace_machine_type"
            echo 
            echo "Be aware that you'll be billed for machine usage. Remember to turn it off when unused or delete it when you're done!"
            echo
            
            read -p "Continue? (y/N): " pspace_create_confirm
            if [[ "$pspace_create_confirm" != "y" && "$pspace_create_confirm" != "Y" ]]; then
                echo "Aborting machine creation."
                exit 8
            fi

            # Run the pspace machine create command with the provided inputs
            
            # pspace machine create \
            #     --name "CloudyPad_$cloudypad_instance_name" \
            #     --template-id $pspace_os_template \
            #     --region $pspace_region \
            #     --disk-size $pspace_disk_size \
            #     --machine-type $pspace_machine_type \
            #     --public-ip-type $pspace_public_ip_type
            #
            # Using curl for now as CLI has a bug preventing machine creation
            # See https://github.com/Paperspace/cli/issues/78
            # Fetch token from authenticated pspace
            # Dirty but works as a workaround for now
            local pspace_team=$(pspace config | grep 'team' | cut -d '"' -f 2)
            local pspace_api_token=$(grep 'taekk107hp' ~/.paperspace/credentials.toml | cut -d '"' -f 2)

            local paperspace_api_response=$(curl --request POST \
                --url https://api.paperspace.com/v1/machines \
                --header "Authorization: Bearer $pspace_api_token" \
                --header 'Content-Type: application/json' \
                --data "{
                    \"diskSize\": $pspace_disk_size,
                    \"machineType\": \"$pspace_machine_type\",
                    \"name\": \"CloudyPad_$cloudypad_instance_name\",
                    \"region\": \"$pspace_region\",
                    \"templateId\": \"$pspace_os_template\",
                    \"publicIpType\": \"$pspace_public_ip_type\",
                    \"startOnCreate\":\"true\"
                }")
            
            local paperspace_machine_id=$(echo $paperspace_api_response | jq .data.id -r)

            
            echo "Paperspace machine creation done (ID: $paperspace_machine_id)"
            ;;
        *)
            echo "Unknown Paperspace machine selection type $cloudypad_machine_choice. This is probably a bug, please report it."
            exit 5
            ;;
    esac

    echo "Configuring Paperspace machine $paperspace_machine_id."

    paperspace_machine_json=$(pspace machine get $paperspace_machine_id --json)
    
    cloudypad_instance_host=$(echo $paperspace_machine_json | jq '.publicIp' -r)
    cloudypad_instance_user=paperspace

    echo "You're going to configure Cloudy Pad on Paperspace:"
    echo "  Machine ID: $paperspace_machine_id"
    echo "  Hostname: $cloudypad_instance_host"
    echo "  SSH user: $cloudypad_instance_user"
    echo
    echo "Please note:"
    echo " - Setup may take some time, especially GPU driver installation."
    echo " - Machine may reboot several time during process, this is expected and should not cause error."
    echo

    local paperspace_install_confirm
    read -p "Do you want to continue? (y/N): " paperspace_install_confirm

    if [[ "$paperspace_install_confirm" != "y" && "$paperspace_install_confirm" != "Y" ]]; then
        echo "Aborting configuration."
        exit 0
    fi

    mkdir -p $(get_cloudypad_instance_dir $cloudypad_instance_name)

    init_ansible_inventory $cloudypad_instance_name $cloudypad_instance_host $cloudypad_instance_user "paperspace" $paperspace_machine_id
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


paperspace_machine_action() {
    pspace_action=$1
    pspace_machine=$2

    echo "Paperspace: $pspace_action $pspace_machine"
    pspace machine $pspace_action $pspace_machine
}
