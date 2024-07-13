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

run_update_ansible() {
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

# Fetch instance IP from inventory
get_cloudypad_instance_host(){
    cloudypad_instance_name=$1
    local inventory_path="$(get_cloudypad_instance_ansible_inventory_path $cloudypad_instance_name)"

    cat $inventory_path | yq ".all.hosts[\"$cloudypad_instance_name\"].ansible_host" -r
}

# Fetch instance IP from inventory
get_cloudypad_instance_user(){
    cloudypad_instance_name=$1
    local inventory_path="$(get_cloudypad_instance_ansible_inventory_path $cloudypad_instance_name)"

    cat $inventory_path | yq ".all.hosts[\"$cloudypad_instance_name\"].ansible_user" -r
}
