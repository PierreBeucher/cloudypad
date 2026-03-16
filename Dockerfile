# https://hub.docker.com/_/node
ARG NODE_VERSION="25.6.1-trixie-slim"
FROM node:${NODE_VERSION} AS base

# Global tooling
RUN apt update && apt install -y \
    python3-pip \
    curl \
    unzip \
    ssh \
    sshpass \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# pnpm for cache efficiency
# Requires PNPM_HOME on PATH
# Cach mounts are used later using these paths
# pnpm requires global-bin-dir to exist nd be on PATH
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm && \
  pnpm config set store-dir /pnpm_store && \
  pnpm config set package-import-method copy

#
# Pulumi (can be copied from /usr/local/bin/pulumi/)
#
FROM base AS pulumi

# https://github.com/pulumi/pulumi/releases
ARG PULUMI_VERSION="v3.221.0"
ARG TARGETPLATFORM
RUN case "$TARGETPLATFORM" in \
      "linux/amd64") \
        curl "https://get.pulumi.com/releases/sdk/pulumi-${PULUMI_VERSION}-linux-x64.tar.gz" -o pulumi.tar.gz ;; \
      "linux/arm64") \
        curl "https://get.pulumi.com/releases/sdk/pulumi-${PULUMI_VERSION}-linux-arm64.tar.gz" -o pulumi.tar.gz ;; \
      *) \
        echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
    esac \
    && tar -xzf pulumi.tar.gz -C /usr/local/bin \
    && rm pulumi.tar.gz

#
# Cloudy Pad
#

# Compile Typescript code in dedicated image to avoid dev dependencies in final image
FROM base AS tsc

WORKDIR /build

COPY package.json    package.json
COPY pnpm-lock.yaml  pnpm-lock.yaml
RUN --mount=type=cache,id=pnmcache,target=/pnpm_store \
  pnpm install --prefer-offline --frozen-lockfile

# ansible required for build as packaged with node code
COPY ansible ansible
COPY src src
COPY LICENSE.txt tsconfig.json tsconfig.build.json . 

# Optional: override package.json version for custom builds
ARG CLOUDYPAD_VERSION
RUN if [ -n "$CLOUDYPAD_VERSION" ]; then \
      sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$CLOUDYPAD_VERSION\"/" package.json; \
    fi

RUN pnpm run build

# 
# Final Cloudypad image
#
FROM base AS final

# Ansible via pip to use fixed version for better reproducibility
# Can't use pipx yet for global install as major distrib have an older version (1.1.0) 
# which does not support pipx ensurepath --global
# Python warns about break-system-packages but should be fine
RUN pip3 install ansible==13.3.0 --break-system-packages

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

# For git install to workaround temporary workaround for Ansible galaxy
# Ansible Galaxy has been down for more than 24h: https://github.com/ansible/galaxy/issues/3585
# returning HTTP 500 errors. Let's use Git in the meantime
RUN apt install git -y && \
  ansible-galaxy collection install -r ansible/requirements.yml -p /usr/share/ansible/collections

# Shorter Ansible logs output
ENV ANSIBLE_STDOUT_CALLBACK=community.general.unixy

# Deps
ENV NODE_ENV=production
COPY package.json    package.json
COPY pnpm-lock.yaml  pnpm-lock.yaml
RUN --mount=type=cache,id=pnmcache,target=/pnpm_store \
  pnpm install --prefer-offline --frozen-lockfile --prod

# Copy built app directly
COPY --from=tsc /build/dist dist/
COPY LICENSE.txt .

# Global install of built app
RUN --mount=type=cache,id=pnmcache,target=/pnpm_store \
  pnpm config set store-dir /pnpm_store && \
  pnpm config set package-import-method copy && \
  pnpm install --global /cloudypad/dist

# Optional: override package.json version for custom builds
ARG CLOUDYPAD_VERSION
RUN if [ -n "$CLOUDYPAD_VERSION" ]; then \
      sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$CLOUDYPAD_VERSION\"/" package.json; \
    fi

ENTRYPOINT  ["cloudypad"]