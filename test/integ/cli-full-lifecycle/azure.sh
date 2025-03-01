function create_destroy_azure() {
    
    instance_name="test-create-destroy-azure"

    $cloudypad_cmd create azure \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --vm-size Standard_NC8as_T4_v3 \
        --disk-size 100 \
        --disk-type Standard_LRS \
        --public-ip-type static \
        --location "francecentral" \
        --spot \
        --subscription-id 0dceb5ed-9096-4db7-b430-2609e7cc6a15 \
        --cost-limit 2 \
        --cost-notification-email "test@test.com" \
        --streaming-server wolf \
        --autostop true \
        --autostop-timeout 300 \
        --yes --overwrite-existing --skip-pairing

    $cloudypad_cmd update azure \
        --name $instance_name \
        --vm-size Standard_NC4as_T4_v3 \
        --disk-size 100 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name --yes
}
