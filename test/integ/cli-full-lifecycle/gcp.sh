function create_destroy_gcp() {
    
    instance_name="test-create-destroy-gcp"

    $cloudypad_cmd create gcp \
        --name $instance_name \
        --machine-type n1-standard-8 \
        --disk-size 100 \
        --public-ip-type static \
        --region "europe-west4" \
        --zone "europe-west4-b" \
        --gpu-type "nvidia-tesla-t4" \
        --project-id crafteo-sandbox \
        --spot \
        --cost-limit 2 \
        --cost-notification-email "test@test.com" \
        --streaming-server sunshine \
        --sunshine-user sunshine \
        --sunshine-password 'S3un$h1ne!"' \
        --sunshine-image-tag dev \
        --autostop true \
        --autostop-timeout 300 \
        --yes --overwrite-existing --skip-pairing

    $cloudypad_cmd update gcp \
        --name $instance_name \
        --machine-type n1-standard-4 \
        --yes

    $cloudypad_cmd get $instance_name

    $cloudypad_cmd list | grep $instance_name

    check_instance_status $instance_name

    $cloudypad_cmd stop $instance_name --wait

    $cloudypad_cmd start $instance_name --wait

    $cloudypad_cmd restart $instance_name --wait

    $cloudypad_cmd destroy $instance_name --yes
}