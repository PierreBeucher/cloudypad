#
# Pulumi
#
FROM curlimages/curl:8.7.1 AS pulumi

WORKDIR /pulumi

RUN curl -LO https://get.pulumi.com/releases/sdk/pulumi-v3.115.0-linux-x64.tar.gz && \
    tar -zxvf pulumi-v3.115.0-linux-x64.tar.gz && \
    rm pulumi-v3.115.0-linux-x64.tar.gz

#
# Cloudy Pad
#
FROM node:22.1.0-bookworm

WORKDIR /app

# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml .

RUN pnpm i

# Pulumi
COPY --from=pulumi --chown=root:root /pulumi/* /usr/local/bin/

RUN ls -al /usr/local/bin/

COPY . .

RUN pnpm build && npm i -g

ENTRYPOINT ["bash"]