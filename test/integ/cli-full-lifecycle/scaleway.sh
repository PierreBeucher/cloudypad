function create_destroy_scaleway() {
    
    instance_name="test-create-destroy-scaleway"

    $cloudypad_cmd create scaleway \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --project-id "02d02f86-9414-4161-b807-efb2bd22d266" \
        --region fr-par \
        --zone fr-par-2 \
        --instance-type GPU-3070-S \
        --disk-size 100 \
        --streaming-server sunshine \
        --sunshine-user sunshine \
        --sunshine-password "sunshine!" \
        --autostop true \
        --autostop-timeout 300 \
        --yes --overwrite-existing --skip-pairing

    $cloudypad_cmd update scaleway \
        --name $instance_name \
        --instance-type L4-1-24G \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name --yes
}