# Maintenance guide

- [Release](#release)
  - [Before release testing](#before-release-testing)
  - [Do release](#do-release)
- [Maintenance](#maintenance)
- [Regular updates](#regular-updates)

## Release

### Before release testing

Some tests are required before release:

- [ ] `task test-unit` (done by CI)
- [ ] `task test-integ-full-lifecycle-all` (done manually since it requires real Cloud accounts)
- [ ] `task test-integ-scaleway-lifecycle-with-server-deletion` (done manually since it requires real Cloud accounts)

### Do release

Set `export GITHUB_TOKEN=xxx` variable and run:

```sh
# Will prompt for details and describe required actions
task release-create
```

## Maintenance

## Regular updates

First:
- [ ] Nix flake update `nix flake update`
- [ ] Also bump version to latest stable if possible

Then:
- [ ] Node dependencies `npm update`
- [ ] NVIDIA Display driver version 
  - Take latest Display Production Linux x86_64 version at [NVIDIA Unix Driver archive page](https://www.nvidia.com/en-us/drivers/unix/)
  - Update in `ansible/roles/nvidia-driver/defaults/main.yml` `nvidia_driver_display_dotrun_install_version`
- [ ] NVIDIA Datacenter driver version 
  - Take latest Datacenter Linux x86_64 version at [NVIDIA Unix Driver archive page](https://developer.nvidia.com/datacenter-driver-archive)
  - Update in `ansible/roles/nvidia-driver/defaults/main.yml` `nvidia_driver_datacenter_dotrun_install_version`
- [ ] NVIDIA Container Toolkit version
  - Check available versions on [APT package](https://nvidia.github.io/libnvidia-container/stable/deb/amd64/Packages)
  - Update in `ansible/roles/nvidia-driver/defaults/main.yml` `nvidia_container_toolkit_version`
- [ ] Wolf version and config
  - [ ] Run `hack/update-wolf-images.sh` to update default images in Ansible role
  - [ ] Update Wolf config template in `ansible/roles/wolf/templates/wolf-config.toml` using default config
    - Generate default config by running a Wolf container (will generate default config on start) and copy it:
    ```
    docker pull ghcr.io/games-on-whales/wolf:stable

    # Run Wolf in the background to auto-generate config file on startup
    docker run -d --name wolf-config ghcr.io/games-on-whales/wolf:stable

    # Copy config file
    docker cp wolf-config:/etc/wolf/cfg/config.toml .
    ```
    - Ensure proper Ansible templates variables are used in TOML config:
      ```toml
      hostname = "{{ wolf_instance_name }}"
      uuid = "{{ wolf_instance_name | ansible.builtin.to_uuid }}"
      # ...

      # For each app, use the related Ansible image, eg for Firefox:
      [apps.runner]
      type = "docker"
      name = "WolfFirefox"
      image = '{{ wolf_app_firefox_image }}'
      ```
- [ ] Sunshine Dockerfile `containers/sunshine/Dockerfile`
  - [ ] Base image version `FROM` - See available tags from [Docker Hub](https://hub.docker.com/_/ubuntu). Make sure to use the imaghe SHA for reproducibility.
  - [ ] Steam version `CLOUDYPAD_STEAM_VERSION` - see stable version at [Steam archive](https://repo.steampowered.com/steam/archive/stable)
  - [ ] Update `SUNSHINE_VERSION` with [latest Sunshine release](https://github.com/LizardByte/Sunshine/releases)
  - [ ] Update `LUTRIS_VERSION` with [latest Lutris release](https://github.com/lutris/lutris/releases)
  - [ ] Update `HEROIC_VERSION` with [latest Heroic Games Launcher version](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/releases)
  - [ ] Update `CLOUDYPAD_HEROIC_DEFAULT_GEPROTON_VERSION` with [latest GE-Proton version](https://github.com/GloriousEggroll/proton-ge-custom/releases)
- [ ] CLI Dockerfile (`Dockerfile` at root)
  - [ ] Pulumi version - see [Pulumi release](https://github.com/pulumi/pulumi/releases)
  - [ ] Node version - see [Docker Hub](https://hub.docker.com/_/node)
  - [ ] Ansible version installed by pip - See [Ansible PyPI page](https://pypi.org/project/ansible/)

Last update and dependency bumps: 2026-02-18