# Installation

- [Requirements for all OS](#requirements-for-all-os)
- [Installation](#installation-1)
  - [Linux](#linux)
  - [MacOS](#macos)
  - [Windows](#windows)
  - [Nix / NixOS](#nix--nixos)
- [Upgrade](#upgrade)

## Requirements for all OS

- A Cloud provider account, one of:
  - AWS
  - Azure
  - Google Cloud
  - Paperspace
  - Scaleway
- [Moonlight](https://moonlight-stream.org/) streaming client
- [Docker](https://docs.docker.com/engine/install/) 
  - Rootless Docker is not supported yet
  - For MacOS, [OrbStack](https://orbstack.dev/) is recommended over Docker Desktop

## Installation

### Linux

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | bash
```

### MacOS

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | zsh
```

**[OrbStack](https://orbstack.dev/) is recommended** over Docker Desktop as it's more compatible for Cloudy Pad usage. 

### Windows

Running Cloudy Pad on Windows [requires WSL to be installed](https://learn.microsoft.com/en-us/windows/wsl/install).

Once WSL is installed, run a Linux shell and follow [Linux installation steps](#linux). 

Note: If you are using SSH keys mounted from Windows host, make sure they have proper permissions: `chmod 0600 ~/.ssh/<key>`

### Nix / NixOS

Cloudy Pad is packaged as a [Nix Flake](https://nixos.wiki/wiki/flakes), see [`flake.nix`](./flake.nix)

You can include it in your NixOS config or run directly with `nix run`:

```sh
nix run github:PierreBeucher/cloudypad create
nix run github:PierreBeucher/cloudypad -- --version
```

## Upgrade

To upgrade to the latest version of `cloudypad`, run the installation process again. It will check for the latest version and install it.

Then, upgrade your instance(s) to get latest changes with:

```sh
cloudypad provision my-instance
cloudypad configure my-instance
```
