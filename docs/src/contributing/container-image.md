# Extend and customize Cloudy Pad container images

Cloudy Pad rely on Docker to run your games and streaming server. You can extend and customize the container images to fit your needs.

This section assumes you know about Docker, Docker Compose and Docker image build.

## Sunshine

Create a `Dockerfile` such as:

```Dockerfile
# Use the same version returned by cloudypad --version
FROM ghcr.io/pierrebeucher/cloudypad/sunshine:0.19.0

# Example: add custom packages
RUN --mount=type=cache,target=/var/cache --mount=type=tmpfs,target=/var/log \
    apt update && \
    apt install -y my-package another-package && \
    apt clean

#
# Add other instructions...
#
```

Build and push your image, for example:

```sh
docker buildx build . -t your-registry/cloudypad-custom:some-tag
docker push your-registry/cloudypad-custom:some-tag
```

Update the Cloudy Pad Sunshine image used by your instance:

```sh
cloudypad update aws my-instance \
    --sunshine-image-registry your-registry/cloudypad-custom \
    --sunshine-image-tag some-tag
```

During development you'll probably need to update your image often to test changes. For faster feedback loop:
- Build and push your image
- [Connect to instance via SSH](../usage/ssh.md), `cd sunshine` and run:
  ```sh
  docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d --pull always
  ```

This will update your instance to use your custom image without having to run entire `cloudypad update`.

## Wolf

Wolf Docker images are based on [GoW images](https://github.com/games-on-whales/gow). They are not maintained by Cloudy Pad but instruction can be found [here](https://github.com/games-on-whales/gow/blob/main/docs/docker.md) to create custom images. You can then update configuration directly in your instance at ` /etc/wolf/cfg` following [Wolf configuration instructions](https://games-on-whales.github.io/wolf/stable/user/configuration.html)

_Note: Wolf custom image is not fully supported yet. On next Cloudy Pad update or `cloudypad configure` run your Wolf config will be overwritten with a custom template. Use this only for development or experimental purposes._