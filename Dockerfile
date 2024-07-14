FROM python:3.12.4-slim-bookworm

#
# Global tooling
#
RUN apt update && apt install -y \
    jq \
    yq \
    openssh-client \
    curl \
    unzip \
    fzf \
    bsdmainutils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Ansible
ARG ANSIBLE_VERSION="10.1.0"
RUN python3 -m pip install ansible=="${ANSIBLE_VERSION}"

# Shorter logs output
ENV ANSIBLE_STDOUT_CALLBACK=community.general.unixy

# Paperspace CLI
ENV PAPERSPACE_INSTALL="/usr/local"
ENV PAPERSPACE_VERSION="1.10.1"
RUN curl -fsSL https://paperspace.com/install.sh | sh -s -- $PAPERSPACE_VERSION

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

# Ansible deps
# Install globally under /etc/ansible
COPY ansible/requirements.yml ansible/requirements.yml
RUN ansible-galaxy role install -r ansible/requirements.yml -p /etc/ansible/roles
RUN ansible-galaxy collection install -r ansible/requirements.yml -p /etc/ansible/collections

# Pulumi deps
# TODO: maybe this can be done ONLY whe Pulumi is used or in a separate image
COPY pulumi/aws/package-lock.json pulumi/aws/package-lock.json
COPY pulumi/aws/package.json pulumi/aws/package.json
RUN npm --prefix pulumi/aws ci

# Copy remaining files
COPY LICENSE.txt   LICENSE.txt
COPY resources     resources/
COPY pulumi        pulumi/
COPY ansible       ansible/
COPY cli-sh        cli-sh/
COPY README.md     README.md
COPY cloudypad-entrypoint.sh  cloudypad-entrypoint.sh

ENTRYPOINT  ["/cloudypad/cloudypad-entrypoint.sh"]