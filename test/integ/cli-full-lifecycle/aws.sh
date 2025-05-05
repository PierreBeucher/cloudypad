function create_destroy_aws() {
    
    instance_name="test-create-destroy-aws"

    $cloudypad_cmd create aws \
        --name $instance_name \
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
        --autostop true \
        --autostop-timeout 300 \
        --yes --overwrite-existing --skip-pairing

    $cloudypad_cmd update aws \
        --name $instance_name \
        --disk-size 101 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    check_instance_status $instance_name

    $cloudypad_cmd stop $instance_name --wait

    # Instance can't be started immediately after stop
    # Error such as "You can't start the Spot Instance 'i-xxx' because the associated Spot Instance request is not in an appropriate state to support start."
    # Waiting a few seconds before starting
    sleep 120

    $cloudypad_cmd start $instance_name --wait
    
    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name --yes
}