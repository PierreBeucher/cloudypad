function create_destroy_paperspace() {
    
    instance_name="test-create-destroy-paperspace"

    $cloudypad_cmd create paperspace \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --machine-type P4000 \
        --disk-size 100 \
        --public-ip-type static \
        --region "East Coast (NY2)" \
        --streaming-server wolf \
        --autostop true \
        --autostop-timeout 300 \
        --yes --overwrite-existing --skip-pairing

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd destroy $instance_name --yes
}