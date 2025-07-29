# Getting started 🚀

Deploy a Cloud gaming instance using your own servers or directly on a Cloud provider like AWS, Azure or Google Cloud

- 💰 While Cloudy Pad itself is free and open-source, charges may be incurred for Cloud provider usage. Make sure you [understand the costs](cost.md)
- Cloudy Pad is Linux-based. Using Steam requires [Proton](https://github.com/ValveSoftware/Proton). You can check your game compatibility on [ProtonDB website](https://www.protondb.com/) or see [how to play games on Steam](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-).

**Cloudy Pad App**

Instructions below are aimed for **tech-savvy users who are familiar with terms such as "server", "ssh" and "NVIDIA drivers".**

If that's not your cup of tea, **you might prefer to use [Cloudy Pad App](https://app.cloudypad.gg/)** instead: a simple, intuitive web platform to deploy your gaming instance in a few minutes.

[🎮 Join Cloudy Pad App](https://app.cloudypad.gg/)

---

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Choose your Provider](#choose-your-provider)
- [Deploy your instance](#deploy-your-instance)
- [Stop your instance after gaming sessions](#stop-your-instance-after-gaming-sessions)
- [Problem ?](#problem-)



## Prerequisites

- [Moonlight](https://moonlight-stream.org/) streaming client
  - Moonlight is client allowing you to connect to your instance and play your games
- Either your own server with an NVIDIA GPU or a Cloud provider:
  - AWS
  - Azure
  - Google Cloud
  - Paperspace
  - Scaleway
- [Docker](https://docs.docker.com/engine/install/) client
  - Rootless Docker is not supported yet
  - For MacOS, [OrbStack](https://orbstack.dev/) is recommended over Docker Desktop

## Installation 

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | bash
```

[➡️ See Installation page](./installation.md) for more installation methods on Linux, Mac and Windows.

## Choose your Provider

Choose a provider:

- [SSH](./cloud-provider-setup/ssh) - Deploy on your own server or machine directly via SSH
- [AWS](./cloud-provider-setup/aws.md) - Create an instance directly on AWS
- [Azure](./cloud-provider-setup/azure.md) - Create an instance directly on Microsoft Azure
- [Google Cloud](./cloud-provider-setup/gcp.md) - Create an instance directly on Google Cloud
- [Scaleway](./cloud-provider-setup/scaleway.md) - Create an instance directly on Scaleway
- [Paperspace](./cloud-provider-setup/paperspace.md) - Create an instance directly on Paperspace

[➡️ Check out per-Cloud provider setup specificities](./cloud-provider-setup).

## Deploy your instance

Create your instance with `cloudypad` CLI:

```sh
cloudypad create
# How shall we name your Cloudy Pad instance? (default: mypad) 
#
# Creating Cloudy Pad instance 'mypad'
#
# [...]
#
# 🥳 Your Cloudy Pad instance is ready !
```

Cloudy Pad will do everything for you automatically:

- Prompt for important information (you can also pass CLI args) 
- Provision and configure your instance
- Install GPU drivers and streaming server ([Wolf](https://games-on-whales.github.io/wolf/stable/) or [Sunshine](https://github.com/LizardByte/Sunshine))
- Help you pair with [Moonlight](https://moonlight-stream.org/) streaming client

Once the installation is complete, run Moonlight, connect and start playing ! 🎮

[➡️ Steam Sign-in guide](./help/steam.md)

[➡️ Moonlight usage and optimization guide](./help/moonlight-usage.md)

## Stop your instance after gaming sessions

Once you are done, **remember to stop your instance to avoid unnecessary costs 💸**

```sh
cloudypad stop mypad
# or 
# cloudypad destroy mypad
```

## Problem ?

😱 Something went wrong? See _Help and Troubleshooting_ section on the left, [FAQ and known issues](./help/faq.md) or [create an issue](https://github.com/PierreBeucher/cloudypad/issues)
