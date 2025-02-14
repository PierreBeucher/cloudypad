function create_destroy_aws() {
    
    instance_name="test-create-destroy-aws"

    $cloudypad_cmd create aws \
        --name $instance_name \
        --private-ssh-key ~/.ssh/id_ed25519 \
        --instance-type g4dn.xlarge \
        --disk-size 100 \
        --public-ip-type static \
        --region eu-central-1 \
        --spot \
        --cost-alert \
        --cost-limit 2 \
        --cost-notification-email "test@test.com" \
        --streaming-server sunshine \
        --sunshine-user sunshine \
        --sunshine-password 'S3un$h1ne!"' \
        --sunshine-image-tag dev \
        --yes --overwrite-existing --skip-pairing

    $cloudypad_cmd update aws \
        --name $instance_name \
        --disk-size 101 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait
    
    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name --yes
}