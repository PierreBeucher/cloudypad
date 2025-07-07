#!/usr/bin/env bash

# Wrapper around CloudyPad container in which most operations are performed 
# so that no other dependency other than Docker or a container runtime is needed
#
# Build a container image with current user ID on the fly (to avoid permission issues)
# and run instructions.
# Only a few commands need to run directly for user (eg. moonlight setup)

if [ -n "$CLOUDYPAD_CLI_LAUNCHER_DEBUG" ]; then
  set -x
fi

CLOUDYPAD_VERSION=0.32.1
CLOUDYPAD_IMAGE="${CLOUDYPAD_IMAGE:-"ghcr.io/pierrebeucher/cloudypad:$CLOUDYPAD_VERSION"}"
CLOUDYPAD_TARGET_IMAGE="cloudypad/local-runner:local"

# Hidden command used during installation to setup Docker image locally
if [ "$1" == "download-container-images" ]; then
    docker pull $CLOUDYPAD_IMAGE >&2
    exit 0
fi

if ! docker image inspect $CLOUDYPAD_IMAGE > /dev/null 2>&1; then
    echo "Please wait a moment while Cloudy Pad container image $CLOUDYPAD_IMAGE is being pulled..." >&2
    echo "This is normally done once during installation but may happen again if you deleted or cleaned-up your local Docker images." >&2
    docker pull $CLOUDYPAD_IMAGE >&2
fi

# Build Dockerfile on-the-fly
# make sure the container's user ID and group match host to prevent permission issue
HOST_UID=$(id -u)
HOST_USER_NAME=$(id -un)
HOST_GID=$(id -g)
HOST_GROUP_NAME=$(id -gn)
cat <<EOF > /tmp/Dockerfile-cloudypad-run
FROM $CLOUDYPAD_IMAGE

# Ensure the host user matches user in container.
# If host user is root, do nothing and run container as root, otherwise:
# - Delete user matching host's user ID if already exists
# - Create group if not exists
# - Create user
RUN if [ "$(id -u $HOST_UID)" -ne 0 ] >/dev/null 2>&1; then \
        if id -u $HOST_UID >/dev/null 2>&1; then \
            deluser \$(id -un $HOST_UID); \
        fi && \
        if ! getent group $HOST_GID >/dev/null; then \
            groupadd -g $HOST_GID $HOST_GROUP_NAME; \
        fi && \
        useradd -u $HOST_UID -g $HOST_GID --home-dir $HOME --create-home $HOST_USER_NAME; \
    fi

USER $HOST_UID
EOF

container_build_output=$(docker build -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run 2>&1)
container_build_result=$?

if [ $container_build_result -ne 0 ]; then
    echo "Error: could not build CloudyPad container image, build exited with code: $container_build_result" >&2
    echo "Build command was: docker build -t $CLOUDYPAD_TARGET_IMAGE - < /tmp/Dockerfile-cloudypad-run 2>&1" >&2
    echo "Build output: "
    echo "$container_build_output"
    echo
    echo "If you think this is a bug, please file an issue." >&2
    exit 1
fi

# Create and run a container for Cloudy Pad
# Builds a docker command with required volumes and env vars so that
# running container matches host:
# - user (uid and main group)
# - mount important directories (such as home and ssh)
# - mount Cloud credentials if available
# - add environment variable matching host
run_cloudypad_docker() {

    # Ensure Cloudy Pad home exists and is secure enough
    # So as not to create it from Docker volume mount as root
    # TODO check permission?
    mkdir -p $HOME/.cloudypad
    chmod 0700 $HOME/.cloudypad

    # Create Paperspace and directory if not already exists to keep it if user log-in from container
    mkdir -p $HOME/.paperspace

    # List of directories to mount only if they exist
    local mounts=(
        "$HOME/.cloudypad"
        "$HOME/.ssh"
        "$HOME/.aws"
        "$HOME/.paperspace"
        "$HOME/.azure"
        "$HOME/.config/gcloud"
        "$HOME/.config/scw"
    )

    # Build run command with proper directories
    local cmd="docker run --rm"

    # Set interactive+tty by default
    # no tty if CLOUDYPAD_CONTAINER_NO_TTY is set (for CI)
    if [ -n "$CLOUDYPAD_CONTAINER_NO_TTY" ]; then
        cmd="$cmd"
    else
        cmd="$cmd -it"
    fi

    # Only mount a directory if it exists on host
    for mount in "${mounts[@]}"; do
        if [ -d "$mount" ]; then
            cmd+=" -v $mount:$mount"
        fi
    done

    # Local environment variables to pass-through in container
    local env_vars=(
        # CloudyPad
        "CLOUDYPAD_LOG_LEVEL"

        # AWS
        "AWS_PROFILE" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "AWS_SESSION_TOKEN" 
        "AWS_DEFAULT_REGION" "AWS_REGION" "AWS_ENDPOINT_URL" "AWS_PROFILE" 
        "AWS_ROLE_ARN" "AWS_ROLE_SESSION_NAME"
        
        # Paperspace
        # Not yet "PAPERSPACE_API_KEY_FILE" as it's likely file won't exist in container as not bind-mounted
        "PAPERSPACE_API_KEY"

        # Azure
        "AZURE_LOCATION" "AZURE_SUBSCRIPTION_ID" "AZURE_CLIENT_ID" "AZURE_SECRET" "AZURE_TENANT"
        "ARM_SUBSCRIPTION_ID" "ARM_CLIENT_ID" "ARM_CLIENT_SECRET" "ARM_TENANT_ID"

        # Google
        "GOOGLE_PROJECT" "GOOGLE_CLOUD_PROJECT" "GCLOUD_PROJECT" "CLOUDSDK_CORE_PROJECT" 
        "GOOGLE_REGION" "GCLOUD_REGION" "CLOUDSDK_COMPUTE_REGION"
        "GOOGLE_ZONE" "GCLOUD_ZONE" "CLOUDSDK_COMPUTE_ZONE"
        "GOOGLE_IMPERSONATE_SERVICE_ACCOUNT"

        # Scaleway
        "SCW_ACCESS_KEY" "SCALEWAY_ACCESS_KEY"
        "SCW_SECRET_KEY" "SCW_TOKEN" "SCALEWAY_TOKEN"
        "SCW_DEFAULT_REGION" "SCW_REGION" "SCALEWAY_REGION"
        "SCW_DEFAULT_ZONE" "SCW_ZONE" "SCALEWAY_ZONE"
        "SCW_API_URL"
        "SCW_INSECURE" "SCW_TLSVERIFY"
        "SCW_PROFILE"
        "SCW_PROJECT_ID" "SCW_DEFAULT_PROJECT_ID"
        "SCW_ORGANIZATION_ID" "SCW_DEFAULT_ORGANIZATION_ID" "SCW_ORGANIZATION"

        # Pulumi
        "PULUMI_BACKEND_URL" "PULUMI_CONFIG_PASSPHRASE"
    )

    for env_var in "${env_vars[@]}"; do
        if [ -n "${!env_var}" ]; then
            cmd+=" -e $env_var=${!env_var}"
        fi
    done

    # Add SSH agent volume and env var if it's available locally
    if [ -n "$SSH_AUTH_SOCK" ]; then
        cmd+=" -v $SSH_AUTH_SOCK:/ssh-agent -e SSH_AUTH_SOCK=/ssh-agent"
    fi

    # If first arg is "debug-container" run a bash as entrypoint
    # This is a hidden command for debugging :)
    if [ "$1" == "debug-container" ]; then
        cmd+=" --entrypoint /bin/bash $CLOUDYPAD_TARGET_IMAGE"
        $cmd
    else
        cmd+=" $CLOUDYPAD_TARGET_IMAGE"
        $cmd "${@}"
    fi
}

run_cloudypad_docker "${@:1}"