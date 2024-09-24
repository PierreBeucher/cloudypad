# Installation

- [Requirements for all OS](#requirements-for-all-os)
- [Linux](#linux)
- [MacOS](#macos)
- [Windows](#windows)
- [Nix / NixOS](#nix--nixos)

## Requirements for all OS

- A Cloud provider account, one of:
  - AWS
  - Azure
  - Google Cloud
  - Paperspace
- [Moonlight](https://moonlight-stream.org/) streaming client
- [Docker](https://docs.docker.com/engine/install/) 
  - Rootless Docker is not supported yet
  - For MacOS, [OrbStack](https://orbstack.dev/) is recommended over Docker Desktop

## Linux

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | sh
```

## MacOS

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | sh
```

**[OrbStack](https://orbstack.dev/) is recommended** over Docker Desktop as it's more compatible for Cloudy Pad usage. 

## Windows

Running Cloudy Pad on Windows [requires WSL to be installed](https://learn.microsoft.com/en-us/windows/wsl/install).

Once WSL is installed, run a Linux shell and follow [Linux installation steps](#linux). 

Note: If you are using SSH keys mounted from Windows host, make sure they have proper permissions: `chmod 0600 ~/.ssh/<key>`

## Nix / NixOS

Cloudy Pad is packaged as a [Nix Flake](https://nixos.wiki/wiki/flakes), see [`flake.nix`](./flake.nix)

You can include it in your NixOS config or run directly with `nix run`:

```sh
nix run github:PierreBeucher/cloudypad create
nix run github:PierreBeucher/cloudypad -- --version
```
