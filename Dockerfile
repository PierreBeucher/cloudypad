FROM node:22.5.1-bookworm-slim AS build

RUN apt update && apt install -y \
    curl \
    unzip 

#
# Pulumi (can be copied from /usr/local/bin/pulumi/)
#
FROM build AS pulumi

ARG PULUMI_VERSION="v3.124.0"
RUN curl "https://get.pulumi.com/releases/sdk/pulumi-${PULUMI_VERSION}-linux-x64.tar.gz" -o pulumi.tar.gz \
    && tar -xzf pulumi.tar.gz -C /usr/local/bin \
    && rm pulumi.tar.gz

#
# Cloudy Pad
#
FROM node:22.5.1-bookworm-slim

# Global tooling
RUN apt update && apt install -y \
    python3 \
    ansible \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Required for Azure DefaultAzureCredential
RUN curl -sL https://aka.ms/InstallAzureCLIDeb -o install.sh && chmod +x install.sh && ./install.sh -y

# Pulumi
COPY --from=pulumi /usr/local/bin/pulumi /usr/local/bin/pulumi
ENV PATH=$PATH:/usr/local/bin/pulumi

# Build and install cloudypad CLI
WORKDIR /cloudypad

# Ansible deps
# Install globally under /etc/ansible
COPY ansible/requirements.yml ansible/requirements.yml
RUN ansible-galaxy role install -r ansible/requirements.yml -p /usr/share/ansible/roles
RUN ansible-galaxy collection install -r ansible/requirements.yml -p /usr/share/ansible/collections

# Shorter Ansible logs output
ENV ANSIBLE_STDOUT_CALLBACK=community.general.unixy

# Deps
COPY package.json       package.json
COPY package-lock.json  package-lock.json
RUN npm install

# Build and install globally
COPY ansible ansible
COPY src src
COPY LICENSE.txt tsconfig.json . 


RUN npm run build
RUN npm install -g

ENTRYPOINT  ["cloudypad"]