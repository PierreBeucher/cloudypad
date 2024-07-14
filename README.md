# Cloudy Pad

Your own gaming gear in the Cloud ! 🎮 ⛅ 

- [Development status 🧪](#development-status-)
- [Features ✨](#features-)
- [Getting started 🚀](#getting-started-)
- [Usage](#usage)
- [Known issues](#known-issues)
  - [`cloudypad init` failure](#cloudypad-init-failure)
  - [Found an bug ?](#found-an-bug-)
- [FAQ](#faq)
  - [How much will I pay ? 🫰](#how-much-will-i-pay--)
  - [What are the recommended specs for my instance ?](#what-are-the-recommended-specs-for-my-instance-)
  - [How to play game on Steam / Why does my Steam game doesn't launch ?](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-)
  - [How does all of this work?](#how-does-all-of-this-work)
  - [Will Cloudy Pad become a paid product ?](#will-cloudy-pad-become-a-paid-product-)
- [License](#license)

## Development status 🧪

This project is still at an experimental phase. While working and allowing you to play in the Cloud seamlessly, there may be breaking changes in the future. Feel free to contribute and provide feedback !

## Features ✨

Compatible with [Moonlight](https://moonlight-stream.org/) streaming client

Cloud providers:

- [Paperspace](https://www.paperspace.com/)
- [AWS](https://aws.amazon.com/)
- (available soon) [TensorDock](https://www.tensordock.com/)
- (available soon) [Azure](https://azure.microsoft.com)
- (available soon) [Google Cloud](https://cloud.google.com)

## Getting started 🚀

Cloudy Pad deploys a Cloud gaming gear using the provider of your choice. Before going further, please read:
- 💸 While Cloudy Pad is free and open-source, charges may still incur for Cloud provider usage. Make sure you [understand the costs](#how-much-will-i-pay--) ;)
- Using Steam may require [Proton](https://www.protondb.com/). You can check your game compatibility on [Proton website](https://www.protondb.com/) or see [how to play games on Steam](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-).
- Cloudy Pad deploys a Linux instance, not Windows. 

Prerequisites:
- A Clouder account, one of:
  - [Paperspace](https://www.paperspace.com/)
  - [AWS](https://aws.amazon.com/)
- [Moonlight](https://moonlight-stream.org/) streaming client
- [Docker](https://docs.docker.com/engine/install/)

Install `cloudypad` CLI:

```sh
curl https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/cloudypad.sh -o ./cloudypad.sh && \
  chmod +x ./cloudypad.sh && \
  sudo cp ./cloudypad.sh /usr/local/bin/cloudypad
```

Let the CLI guide you through creation of your Cloudy Pad instance:
- Create a new machine automatically or use an existing machine
- Configure GPU drivers and [Wolf gaming server](https://games-on-whales.github.io/wolf/stable/)
- Pair with Moonlight

```sh
cloudypad init
# How shall we name your Cloudy Pad instance? (default: mypad) 
#
# Initializing Cloudy Pad instance 'mypad'
#
# [...]
#
# 🥳 Your Cloudy Pad instance is ready !
```

_Note: a non interactive method such as `cloudypad init --provider paperspace --disk-size 200 ...` is in the work_

😱 Something went wrong? See [Known issues](#known-issues), [FAQ](#faq) or [create an issue](https://github.com/PierreBeucher/cloudypad/issues)

**Remember to stop your instance when you're done to avoid unnecessary costs 💸**

```sh
cloudypad stop mypad
```

## Usage

_🧪 `cloudypad` CLI interface is still experimental and may change in the future_

Available commands:

```sh
cloudypad {init|update|start|stop|restart|get|list|pair|ssh|debug-container}
```

List existing instances:

```sh
cloudypad list
# mypad
# another-instance
# super-powerful-pad
```

Update instance configuration

```sh
cloudypad update [instance]
```


Start, stop or restart an instance
```sh
cloudypad start [instance]
cloudypad stop [instance]
cloudypad restart [instance]
```

Get details of a specific instance.

```sh
cloudypad get [instance]
```

Pair Moonlight with an existing instance:

```sh
cloudypad pair [instance]
```

SSH into you Cloudy Pad instance

```sh
cloudypad ssh [myinstance]
```

Run a Cloudy Pad debug container (container used internally by the CLI with underlying binaries used to deploy instances)

```sh
cloudypad debug-container
```

## Known issues

### `cloudypad init` failure

`cloudypad init` may fail because of timeout or other intermittent error. You can simply restart the init process using the name initially provided, for example if you named your instance `mypad` you can run:

```sh
cloudypad init mypad
```

As `init` process is idempotent it restart but won't do again what's already done.

Alternatively, you can run a specific part of the init process:

```sh
cloudypad update mypad # Only run instance configuration
cloudypad pair mypad   # Pair instance
```

### Found an bug ?

If you found a bug, [please file an issue](https://github.com/PierreBeucher/cloudypad) !

## FAQ

### How much will I pay ? 🫰

Cloudy-Pad is free and open-source, however charges may apply when using a Cloud provider. Typically billed resources:
- Machine usage (GPU, CPU, RAM)
- Disk storage
- IP address reservation

Here's an estimation table for supported providers. Example: using Paperspace P4000 10 hours per month with a 50GB disk will cost approximatively 13.10$

**Paperspace**

| Instance Type | 10h / month 50 GB disk | 10h / month 100 GB disk | 10h / month 250 GB disk | 20h / month 100 GB disk | 20h / month 250 GB disk | 30h / month 250 GB disk |
|---------------|------------------------|-------------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| P4000         | $13.10                 | $15.10                  | $18.10                  | $20.20                  | $23.20                  | $28.30                  |
| RTX4000       | $13.60                 | $15.60                  | $18.60                  | $21.20                  | $24.20                  | $29.80                  |
| P5000         | $15.80                 | $17.80                  | $20.80                  | $25.60                  | $28.60                  | $36.40                  |
| RTX5000       | $16.20                 | $18.20                  | $21.20                  | $26.40                  | $29.40                  | $37.60                  |
| P6000         | $19.00                 | $21.00                  | $24.00                  | $32.00                  | $35.00                  | $46.00                  |

**AWS**

| Instance Type | 10h / month 50 GB disk | 10h / month 100 GB disk | 10h / month 250 GB disk | 20h / month 100 GB disk | 20h / month 250 GB disk | 30h / month 250 GB disk |
|---------------|------------------------|-------------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| **g5.xlarge** | $17.66                 | $21.66                  | $33.66                  | $31.72                  | $43.72                  | $53.78                  |
| **g5.2xlarge**| $19.72                 | $23.72                  | $35.72                  | $35.84                  | $47.84                  | $59.96                  |
| **g6.xlarge** | $15.65                 | $19.65                  | $31.65                  | $27.70                  | $39.70                  | $47.74                  |
| **g6.2xlarge**| $17.38                 | $21.38                  | $33.38                  | $31.15                  | $43.15                  | $52.93                  |


_*Estimation based on AWS eu-east-1 and Paperspace pricing on July 2024. Exact prices vary with time and regions._

Estimation for other providers will be added as they are implemented. If you see a significant difference between this table and your observed cost do not hesitate to [report it or update it !](https://github.com/PierreBeucher/cloudypad)

### What are the recommended specs for my instance ?

General recommandations:
- Choose a location or region as close as possible to you to avoid too much latency (eg. if you live in the US don't create your instance in Europe)
- Just provision what you need for: don't create a 1000 GB disk if you intend to play a game that will only use 50 GB. 
- GPU / machine type depends on the game you play. For most game, Paperspace `RTX4000` or AWS `g5` should be sufficient - you can still update later !

Otherwise it depends on the kind of game you aim to play.

### How to play game on Steam / Why does my Steam game doesn't launch ?

In order to play games on Steam you may need to enable Proton:

- Go to game properties (_Gear button on the right > Properties_)
- Enable Proton in the Compatibility menu

See [ProtonDB](https://www.protondb.com/)

### How does all of this work?

`cloudypad` is a wrapper around a few technologies:

- [Wolf](https://games-on-whales.github.io/wolf/stable/) gaming server
- Clouder-specific tools and APIs to deploy and manage Cloud machines
- When possible, [Pulumi](https://www.pulumi.com/) to deploy Cloud machines and resources
- [Ansible](https://www.ansible.com/) to configure machines (drivers, gaming server, etc.)
- 🧠 Brain juice from me and other awesome open-source community members

### Will Cloudy Pad become a paid product ?

Probably not in it's current form. Considering I'm really _not_ happy about the [enshittification of the internet](https://en.wikipedia.org/wiki/Enshittification), Cloudy Pad will remain FOSS - at least for personal use.

Cloudy Pad may have a Premium or Pro offer in the future, but for a personal simple use it will remain FOSS. 

## License

[GNU GENERAL PUBLIC LICENSE](./LICENSE.txt)