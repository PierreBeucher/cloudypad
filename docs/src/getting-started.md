# Getting started 🚀

Cloudy Pad deploys a Cloud gaming gear using a Cloud provider of your choice:
- 💰 While Cloudy Pad itself is free and open-source, charges may incur for Cloud provider usage. Make sure you [understand the costs](cost.md)
- Cloudy Pad lets you play on Linux. Using Steam may require [Proton](https://github.com/ValveSoftware/Proton). You can check your game compatibility on [ProtonDB website](https://www.protondb.com/) or see [how to play games on Steam](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-).

---

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Cloud provider setup](#cloud-provider-setup)
- [Deploy your instance](#deploy-your-instance)
- [Run Moonlight and connect to your instance](#run-moonlight-and-connect-to-your-instance)
- [Sign-in to Steam and play your game](#sign-in-to-steam-and-play-your-game)
- [Stop your instance after gaming sessions](#stop-your-instance-after-gaming-sessions)
- [Problem ?](#problem-)

## Prerequisites

- [Moonlight](https://moonlight-stream.org/) streaming client
  - Moonlight is client allowing you to connect to your instance and play your games
- A Cloud provider account, one of:
  - AWS
  - Azure
  - Google Cloud
  - Paperspace
- [Docker](https://docs.docker.com/engine/install/) 
  - Rootless Docker is not supported yet
  - For MacOS, [OrbStack](https://orbstack.dev/) is recommended over Docker Desktop

## Installation 

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | bash
```

[➡️ See Installation page](./installation.md) for more installation methods on Linux, Mac and Windows.

## Cloud provider setup

You may need to setup a few things on your Cloud provider (eg. API key or SSH key). 

[➡️ Checkout per-Cloud provider setup specifities](./cloud-provider-setup).

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

Cloudy Pad will guide you through creation process:
- Prompt important information (eg. machine type, GPU, cost alerts, etc.) 
- Create a new Cloud machine and related configurations automatically
- Install GPU drivers and streaming server ([Wolf](https://games-on-whales.github.io/wolf/stable/) or [Sunshine](https://github.com/LizardByte/Sunshine))
- Help your Pair with [Moonlight](https://moonlight-stream.org/) streaming client

## Run Moonlight and connect to your instance

Run Moonlight, select your instance and run Steam. `cloudypad create` should have let you pair your Moonlight client with your instance. If needed, you can pair your Moonlight client with your instance manually:

[➡️ See Moonlight setup and pairing guide](./usage/moonlight-setup.md)

## Sign-in to Steam and play your game

To sign-in to Steam, either:
- Type your login and password directly
  - 💡 **Copy/pasting your login and password in Moonlight**: use `CTRL+C` on your host and paste in Moonlight with `CTRL+SHIFT+ALT+V`
- Use Steam mobile app and scan QR code: run Steam app on your phone, and click on shield 🛡️ button (bottom middle of the screen). Scan QR code from Moonlight.

## Stop your instance after gaming sessions

Once you are done, **remember to stop your instance to avoid unnecessary costs 💸**

```sh
cloudypad stop mypad
# or 
# cloudypad destroy mypad
```

## Problem ?

😱 Something went wrong? See [FAQ and known issues](./usage/faq.md) or [create an issue](https://github.com/PierreBeucher/cloudypad/issues)
