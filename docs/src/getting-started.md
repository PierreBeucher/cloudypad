# Getting started 🚀

Cloudy Pad deploys a Cloud gaming gear using a Cloud provider of your choice:
- 💰 While Cloudy Pad itself is free and open-source, charges may incur for Cloud provider usage. Make sure you [understand the costs](cost.md)
- Cloudy Pad lets you play on Linux. Using Steam may require [Proton](https://github.com/ValveSoftware/Proton). You can check your game compatibility on [ProtonDB website](https://www.protondb.com/) or see [how to play games on Steam](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-).

## Prerequisites

- A Cloud provider account, one of:
  - AWS
  - Azure
  - Google Cloud
  - Paperspace
- [Moonlight](https://moonlight-stream.org/) streaming client
- [Docker](https://docs.docker.com/engine/install/) 
  - Rootless Docker is not supported yet
  - For MacOS, [OrbStack](https://orbstack.dev/) is recommended over Docker Desktop

## Installation 

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | bash
```

For other installation methods, see [Installation](#installation)

## Cloud provider setup

You may need to setup a few things on your Cloud provider (eg. API key or SSH key). Checkout [per-Clouder setup specifities](./cloud-provider-setup).

## Deploy your instance !

Once ready, create your instance with `cloudypad` CLI:

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

Cloudy Pad will:
- Create a new Cloud machine and related configurations automatically (you can also use an existing machine)
- Install GPU drivers and [Wolf gaming server](https://games-on-whales.github.io/wolf/stable/)
- Help your Pair with Moonlight

## Play your game

Run Moonlight and connect to your instance. Run Steam, login, install your game and enjoy.

To connect with Steam, either:
- Type your login and password directly
- Use Steam smartphone app and scan QR code (run Steam app, log in to your account and click on shield button at the bottom) 

## Stop your instance after gaming sessions

Once you are done, **remember to stop your instance to avoid unnecessary costs 💸**

```sh
cloudypad stop mypad
# or 
# cloudypad destroy mypad
```

## Problem ?

😱 Something went wrong? See [FAQ and known issues](./usage/faq.md) or [create an issue](https://github.com/PierreBeucher/cloudypad/issues)
