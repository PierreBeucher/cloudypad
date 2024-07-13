FROM python:3.12.4-bookworm

#
# Global tooling
#
RUN apt update && apt install -y \
    jq \
    yq \
    curl \
    unzip \
    less \
    groff \
    fzf \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Ansible
ARG ANSIBLE_VERSION="10.1.0"
RUN python3 -m pip install ansible=="${ANSIBLE_VERSION}"

# Shorter logs output
ENV ANSIBLE_STDOUT_CALLBACK=community.general.unixy

# Paperspace CLI
# TODO it seems possible to force version via script argument
RUN curl -fsSL https://paperspace.com/install.sh | sh
ENV PATH="$PATH:/root/.paperspace/bin"

# AWS
ARG AWS_CLI_VERSION="2.17.12"
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${AWS_CLI_VERSION}.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

# Pulumi + Node
RUN curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && \
    sh nodesource_setup.sh && \
    apt-get install -y nodejs
    

RUN curl https://get.pulumi.com/releases/sdk/pulumi-v3.124.0-linux-x64.tar.gz -o pulumi.tar.gz \
    &&  tar -xzf pulumi.tar.gz -C /usr/local/bin \
    && rm pulumi.tar.gz

ENV PATH=$PATH:/usr/local/bin/pulumi

#
# Cloudy Pad 
#


WORKDIR /cloudypad

COPY ansible ansible/

RUN ansible-galaxy role install -r ansible/requirements.yml
RUN ansible-galaxy collection install -r ansible/requirements.yml