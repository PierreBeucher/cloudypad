# Cloudy Pad

Your own gaming gear in the Cloud ! 🎮 ⛅ 

- [What is Cloudy Pad ?](#what-is-cloudy-pad-)
- [Development status 🧪](#development-status-)
- [Features ✨](#features-)
- [Getting started 🚀](#getting-started-)
- [Installation](#installation)
  - [Linux \& MacOS](#linux--macos)
  - [Windows](#windows)
  - [Nix / NixOS](#nix--nixos)
- [Usage](#usage)
  - [`cloudypad` CLI](#cloudypad-cli)
  - [Connect via SSH to instance](#connect-via-ssh-to-instance)
- [Detailed setup per Clouder](#detailed-setup-per-clouder)
  - [Paperspace](#paperspace)
  - [AWS](#aws)
    - [Quotas](#quotas)
  - [Azure](#azure)
    - [Quotas](#quotas-1)
    - [Profile and environment variables](#profile-and-environment-variables)
  - [Google Cloud](#google-cloud)
    - [Quotas](#quotas-2)
- [FAQ](#faq)
  - [How much will I pay ? 🫰](#how-much-will-i-pay--)
    - [Paperspace](#paperspace-1)
    - [AWS](#aws-1)
    - [Azure](#azure-1)
    - [Google Cloud](#google-cloud-1)
  - [What are the recommended GPU and specs for my instance ?](#what-are-the-recommended-gpu-and-specs-for-my-instance-)
    - [AWS](#aws-2)
    - [Paperspace](#paperspace-2)
    - [Azure](#azure-2)
    - [Google Cloud](#google-cloud-2)
  - [How can I log-in to Steam?](#how-can-i-log-in-to-steam)
  - [How to play game on Steam / Why does my Steam game doesn't launch ?](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-)
  - [Using Steam, why does my game take forever to "cache Vulkan shader" ?](#using-steam-why-does-my-game-take-forever-to-cache-vulkan-shader-)
  - [I have a black screen when I connect to my instance](#i-have-a-black-screen-when-i-connect-to-my-instance)
  - [I Found an bug or I have a suggestion](#i-found-an-bug-or-i-have-a-suggestion)
  - [How does all of this work?](#how-does-all-of-this-work)
  - [Will Cloudy Pad become a paid product ?](#will-cloudy-pad-become-a-paid-product-)
- [Known issues](#known-issues)
  - [Docker for MacOS and VirtioFS](#docker-for-macos-and-virtiofs)
- [License](#license)

## What is Cloudy Pad ?

![](docs/assets/cloudypad-overview.png)

Cloudy Pad lets you deploy a Cloud gaming server anywhere in the world and play your own games - without requiring a powerful gaming machine or a costly subscription:

- Only pay what you play for ! No subscription or long-term commitment.
- Occasional player? Pay less than $10 / month ! 
- Play up to 40h / month for less than $40 
- Use your own game library. Don't be limited to titles that you may lose access to.
- Pick the machine and GPU suitable for your needs. 

**Not familiar with Cloud Gaming ?** See [What's Cloud Gaming and how is Cloudy Pad useful ?](./docs/what-is-cloudy-pad.md)

## Development status 🧪

This project is still at an experimental phase. While working and allowing you to play in the Cloud seamlessly, there may be breaking changes in the future. **Your feedback, bug reports and contribution will be greatly appreciated !**

## Features ✨

Compatible with [Moonlight](https://moonlight-stream.org/) streaming client

Available Cloud providers:

- [Paperspace](https://www.paperspace.com/)
- [Google Cloud](https://cloud.google.com)
- [Azure](https://azure.microsoft.com)
- [AWS](https://aws.amazon.com/)

Potential future Cloud providers - upvote them on their GitHub issues!
- [Oblivus](https://oblivus.com/pricing/) - [👍 on GitHub issue](https://github.com/PierreBeucher/cloudypad/issues/4) if you want it implemented
- [TensorDock](https://www.tensordock.com/) - [👍 on GitHub issue](https://github.com/PierreBeucher/cloudypad/issues/5) if you want it implemented
- [Vulture](https://www.vultr.com/pricing/#cloud-gpu) - [👍 on GitHub issue](https://github.com/PierreBeucher/cloudypad/issues/3) if you want it implemented

## Getting started 🚀

Not familiar with terms like _"Cloud gaming"_, _"Moonlight"_, _"Cloud Provider"_ _"terminal"_ or _"CLI"_ ? Visit [What's Cloud Gaming and how is Cloudy Pad useful ?](./docs/what-is-cloudy-pad.md) first 😉

Cloudy Pad deploys a Cloud gaming gear using a Cloud provider of your choice:
- 💸 While Cloudy Pad itself is free and open-source, charges may incur for Cloud provider usage. Make sure you [understand the costs](#how-much-will-i-pay--) 
- Cloudy Pad lets you play on Linux. Using Steam may require [Proton](https://github.com/ValveSoftware/Proton). You can check your game compatibility on [ProtonDB website](https://www.protondb.com/) or see [how to play games on Steam](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-).

Prerequisites:
- A Cloud provider account, one of:
  - [Paperspace](https://www.paperspace.com/)
  - [AWS](https://aws.amazon.com/)
- [Moonlight](https://moonlight-stream.org/) streaming client
- [Docker](https://docs.docker.com/engine/install/) (other container engine support will come soon)

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | sh
```

For other installation methods, see [Installation](#installation)

You may need to setup a few things on your Cloud provider (eg. API key or SSH key). Checkout [per-Clouder setup specifities](#detailed-setup-per-clouder).

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

Once you are done, **remember to stop your instance to avoid unnecessary costs 💸**

```sh
cloudypad stop mypad
# or 
# cloudypad destroy mypad
```

😱 Something went wrong? See [Known issues](#known-issues), [FAQ](#faq) or [create an issue](https://github.com/PierreBeucher/cloudypad/issues)

## Installation

### Linux & MacOS

Install latest version of `cloudypad` CLI:

```sh
curl -fsSL https://raw.githubusercontent.com/PierreBeucher/cloudypad/master/install.sh | sh
```

### Windows

Running Cloudy Pad on Windows [requires WSL to be installed](https://learn.microsoft.com/en-us/windows/wsl/install). 

Once WSL is installed, run a Linux shell and follow [Linux installation steps](#linux--macos). 

### Nix / NixOS

Cloudy Pad is packaged as a [Nix Flake](https://nixos.wiki/wiki/flakes), see [`flake.nix`](./flake.nix)

You can include it in your NixOS config or run directly with `nix run`:

```sh
nix run github:PierreBeucher/cloudypad create
nix run github:PierreBeucher/cloudypad -- --version
```

## Usage

### `cloudypad` CLI

_🧪 `cloudypad` CLI interface is still experimental and may change in the future_

Available commands:

```sh
$ cloudypad --help
Options:
  --verbose, -v     Verbosity level (0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal)
  -V, --version     output the version number
  -h, --help        display help for command

Commands:
  list              List all instances
  create [name]     Create a new instance
  start <name>      Start an instance
  stop <name>       Stop an instance
  restart <name>    Restart an instance
  get <name>        Get details of an instance
  provision <name>  Provision an instance (deploy or update Cloud resources)
  configure <name>  Configure an instance (connect to instance and install drivers, packages, etc.)
  destroy <name>    Destroy an instance
  pair <name>       Pair an instance with Moonlight
  help [command]    display help for command
```

List existing instances:

```sh
cloudypad list
```

Provision an instance. This will create/update Cloud resources for your instance. 

```sh
cloudypad provision mypad
```

Start, stop or restart an instance

```sh
cloudypad start mypad
cloudypad stop mypad
cloudypad restart mypad
```

Get details of a specific instance.

```sh
cloudypad get mypad
```

Pair Moonlight with an existing instance:

```sh
cloudypad pair mypad
```

### Connect via SSH to instance

You specified an SSH key when creating your instance. Retrieve your instance details to show its IP and SSH user:

```sh 
$ cloudypad get mypad
{
  "name": "mypad",
  "host": "5.120.23.178", <==== Instance IP
  "ssh": {
    "privateKeyPath": "/home/crafteo/.ssh/id_ed25519",
    "user": "ubuntu"  <===== SSH user
  },
  "status": {
    ...
  },
  "provider": {
    "aws": {
      ...
    }
  },
}
```

Connect via SSH:

```sh
ssh ubuntu@5.120.23.178

# If needed, specify SSH key
ssh -i /home/crafteo/.ssh/id_ed25519 ubuntu@5.120.23.178
```

## Detailed setup per Clouder

### Paperspace

If you don't already have a Paperspace account, [create an account](https://console.paperspace.com/signup).

If you haven't already setup an SSH key in your profile:

- If needed, generate an SSH key with `ssh-keygen -t ed25519 -a 100`
- Log into your account and go to _Your account > SSH Keys > Add new SSH key_ to add your key. ([see doc for details](https://docs.digitalocean.com/products/paperspace/accounts-and-teams/add-ssh-keys/))

You'll need an API key to create your instance:

- Go to _Team settings > API Keys > Add_ ([see doc for details](https://docs.digitalocean.com/reference/paperspace/api-keys/))

You're good to go ! Create your instance with

```sh
cloudypad create
```


### AWS

If you don't already have an AWS account, [create an account](https://signin.aws.amazon.com/signup?request_type=register) or use an existing account.

Configure your credentials locally ([see official documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html))

Check your configuration:

```sh
$ aws sts get-caller-identity
{
    "UserId": "AID...YOUR_USER_ID",
    "Account": "123456789",
    "Arn": "arn:aws:iam::123456789:user/crafteo"
}
```

You're good to go ! Create your instance with

```sh
cloudypad create
```

#### Quotas

You may need to increase quota to create the related instance type. If you get an error related to quota:
- Go to AWS console and open "Service Quotas" service
- Go to _AWS Services_ > search for _Amazon Elastic Compute Cloud (Amazon EC2)_ and open it
- Search for _Running On-Demand G and VT instances_ (or the related instance type) and request a quota increase
- Use a quota value according to the instance type you want to use. For example, `2xlarge` requires at least 8 vCPU.

See [AWS service quotas](https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html) for details.

### Azure

If you don't already have an Azure account, [create an account](https://account.azure.com/signup?showCatalog%20=%20True) or use an existing account.

Configure your credentials locally ([see official documentation](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively))

Check your configuration:

```sh
$ az account list
[
  {
    "cloudName": "AzureCloud",
    "homeTenantId": "xxx",
    "id": "xxx",
    "isDefault": true,
    "managedByTenants": [],
    "name": "My Azure Subcription",
    "state": "Enabled",
    "tenantId": "xxx",
    "user": {
      "name": "you@example.com",
      "type": "user"
    }
  }
]
```

#### Quotas

You may need to increase quota to create the desired instance type. If you get an error related to quota:
- Go to Azure console and open "Quotas" service
- Go to _Compute_ > filter for your Subscription / Location and search for _NC_, _NC_ or the instance type prefix you want to use
- Click on quota name and _New Quota Request_
- Fill-out the quota request and submit

Quota is usually accepted within 24 to 48h.

#### Profile and environment variables 

If you want to use an AWS Profile or specific AWS credentials, use environment variables such as:

```sh
export AWS_PROFILE=myprofile
```

See [AWS environment variable list](https://docs.aws.amazon.com/sdkref/latest/guide/settings-reference.html#EVarSettings) for existing variables. Not there are certain limitations as most Cloudy Pad workflow run in a container which may cause some variables to misbehave. Please create an issue if you encounter a problem. 

### Google Cloud

If you don't already have a Google Cloud account, [create an account](https://console.cloud.google.com/) or use an existing account.

Configure your credentials locally ([see official documentation](https://cloud.google.com/sdk/docs/install))

Check your configuration:

```sh
$ gcloud auth list

Credentialed Accounts
ACTIVE  ACCOUNT
*       your_email@gmail.com
```

#### Quotas

You may need to increase quota to create the desired instance type. If you get an error related to quota, see [Google Cloud Quota doc](https://cloud.google.com/docs/quotas/view-manage) to update your quotas.

## FAQ

### How much will I pay ? 🫰

Cloudy-Pad is free and open-source; however, charges may apply when using a Cloud provider. Typically billed resources:
- Machine usage (GPU, CPU, RAM)
- Disk storage
- IP address reservation

Here are estimation tables for supported providers. For example, using Paperspace `P4000` instance for 10 hours / month with a 50GB disk will cost approximatively 13.10$.

_These pricing are estimations from actual prices but may be outdated. If you see a significant difference between these tables and your observed cost do not hesitate to [report it or update it !](https://github.com/PierreBeucher/cloudypad)_

#### Paperspace

| Instance Type | 10h / month 50 GB disk | 10h / month 100 GB disk | 10h / month 250 GB disk | 20h / month 100 GB disk | 20h / month 250 GB disk | 30h / month 250 GB disk |
|---------------|------------------------|-------------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| **P4000**         | $13.10                 | $15.10                  | $18.10                  | $20.20                  | $23.20                  | $28.30                  |
| **RTX4000**       | $13.60                 | $15.60                  | $18.60                  | $21.20                  | $24.20                  | $29.80                  |
| **P5000**         | $15.80                 | $17.80                  | $20.80                  | $25.60                  | $28.60                  | $36.40                  |
| **RTX5000**       | $16.20                 | $18.20                  | $21.20                  | $26.40                  | $29.40                  | $37.60                  |
| **P6000**         | $19.00                 | $21.00                  | $24.00                  | $32.00                  | $35.00                  | $46.00                  |

_*Estimations based on Paperspace pricing as of July 2024. Exact prices may vary over time and by region._

#### AWS

| Instance Type   | 10h / month 50 GB disk | 10h / month 100 GB disk | 10h / month 250 GB disk | 20h / month 100 GB disk | 20h / month 250 GB disk | 30h / month 250 GB disk |
|-----------------|------------------------|-------------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| **g4dn.xlarge** | $12.86                 | $16.86                  | $28.86                  | $22.12                  | $34.12                  | $39.38                  |
| **g4dn.2xlarge**| $15.12                 | $19.12                  | $31.12                  | $26.64                  | $38.64                  | $46.16                  |
| **g5.xlarge**   | $17.66                 | $21.66                  | $33.66                  | $31.72                  | $43.72                  | $53.78                  |
| **g5.2xlarge**  | $19.72                 | $23.72                  | $35.72                  | $35.84                  | $47.84                  | $59.96                  |
| **g6.xlarge**   | $15.65                 | $19.65                  | $31.65                  | $27.70                  | $39.70                  | $47.74                  |
| **g6.2xlarge**  | $17.38                 | $21.38                  | $33.38                  | $31.15                  | $43.15                  | $52.93                  |

_*Estimations based on AWS eu-east-1 pricing as of July 2024. Exact prices may vary over time and by region._

#### Azure

| Azure                            | 10h / month 50 GB disk | 10h / month 100 GB disk | 10h / month 250 GB disk | 20h / month 100 GB disk | 20h / month 250 GB disk | 30h / month 250 GB disk |
|----------------------------------|------------------------|-------------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| NV6ads A10 v5 (6 CPU, 55GB RAM)   | $8.59                  | $12.64                  | $24.79                  | $17.18                  | $29.33                  | $33.87                  |
| NC8as T4 v3 (8 CPU, 56GB RAM)     | $11.57                 | $15.62                  | $27.77                  | $23.14                  | $35.29                  | $42.81                  |

_*Estimations based on Azure US pricing as of August 2024. Exact prices may vary over time and by region._

#### Google Cloud

| Google Cloud                     | 10h / month 50 GB disk | 10h / month 100 GB disk | 10h / month 250 GB disk | 20h / month 100 GB disk | 20h / month 250 GB disk | 30h / month 250 GB disk |
|----------------------------------|------------------------|-------------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| **4 CPU / 15GB RAM / Tesla T4**       | $6.77                  | $12.77                  | $30.77                  | $13.54                  | $31.54                  | $32.31                  |
| **4 CPU / 15GB RAM / Tesla P4**       | $7.32                  | $13.32                  | $31.32                  | $14.64                  | $32.64                  | $33.96                  |
| **8 CPU / 30GB RAM / Tesla T4**       | $7.54                  | $13.54                  | $31.54                  | $15.08                  | $33.08                  | $34.62                  |
| **8 CPU / 30GB RAM / Tesla P4**       | $8.64                  | $14.64                  | $32.64                  | $17.28                  | $35.28                  | $37.92                  |

_Instances used for estimation: N1 Standard. Estimations based on Google Cloud us-central-1 as of August 2024. Exact prices may vary over time and by region._

### What are the recommended GPU and specs for my instance ?

General recommendations:
- Choose a location or region as close as possible to you to avoid too much latency (eg. if you live in the US don't create your instance in Europe)
- Just provision what you need for: don't create a 1000 GB disk if you intend to play a game that will only use 50 GB. 
- GPU / machine type depends on the game you play. See below for recommendations.

#### AWS

`xlarge` instances should be enough for most usage. For instance, `g4dn.xlarge` can run Baldur's Gate 3 in Ultra with 60 FPS 1080 without issues. Use a larger instance only if you have latency related to resource consumption. 

#### Paperspace

Paperspace `RTX4000` or `P4000` or `M4000` are relatively cheap and powerful enough for most use. A `P4000` can run Baldur's Gate 3 in Ultra with 60 FPS 1080 without issues.

Use higher-tier instance if you have latency related to resource consumption.

#### Azure

Use NC or NV instances with 4 to 8 CPUs, eg. one of:

- NC4as T4 v3 (4 CPU, 28 GB RAM)
- NC8as T4 v3 (8 CPU, 56 GB RAM)
- NV6ads A10 v5 (6 CPU, 55GB RAM)

Azure provide more opwerful instance but they are likely too expansive (providing lots of memory and ephemeral storage which is likely unused for gaming but expensive).

Azure gaming instances NG are not yet supported (they use AMD GPU while only NVIDIA is supported for now)

#### Google Cloud

Use N1 Standard instances with 4 to 16 CPUs with T4 or P4 GPUs. They are the cheapest while providing a good experience, eg. a P4 with 15GB RAM and 8 CPU can run Baldur's Gate 3 in Ultra with 60 FPS.

### How can I log-in to Steam?

When you run Steam, you'll be prompted to login either via QR code or login/password. You can either:

- Enter your login / password manually
- Use the Steam app to login via QR code: download and login with the Steam app on your smartphone, then click on the Steam Guard icon (shield icon at the bottom) and scan the QR code shown. 

### How to play game on Steam / Why does my Steam game doesn't launch ?

In order to play games on Steam you may need to enable Proton:

- Go to game properties (_Gear button on the right > Properties_)
- Enable Proton in the Compatibility menu

It's recommended to check your game Proton compatibility on [ProtonDB](https://www.protondb.com/). You may need to add a few Launch options (_Game properties > General > Launch options_).

### Using Steam, why does my game take forever to "cache Vulkan shader" ?

If this is the first time you run your game this is (unfortunately) expected. Steam may cache Vulkan shaders to optimize in-game performance. It should be faster on subsequent runs, if not instantaneous. 

### I have a black screen when I connect to my instance

If this is the first time you connect to your instance, it may take a few minutes to setup the required components. If after 5 min the problem persists, please file an issue. 

### I Found an bug or I have a suggestion

If you found a bug or have a suggestion, [please report an issue](https://github.com/PierreBeucher/cloudypad/issues). Thanks for your feedback !

### How does all of this work?

`cloudypad` is a wrapper around a few technologies:

- [Wolf](https://games-on-whales.github.io/wolf/stable/) gaming server
- Clouder-specific tools and APIs to deploy and manage Cloud machines
- When possible, [Pulumi](https://www.pulumi.com/) to deploy Cloud machines and resources
- [Ansible](https://www.ansible.com/) to configure machines (drivers, gaming server, etc.)
- 🧠 Brain juice from me and other awesome open-source community members

### Will Cloudy Pad become a paid product ?

Probably not in its current form. Considering I'm really _not_ happy about the [enshittification of the internet](https://en.wikipedia.org/wiki/Enshittification), Cloudy Pad will remain FOSS - at least for personal use.

Cloudy Pad may have a Premium or Pro offer in the future, but for a personal simple use it will remain FOSS.

## Known issues

### Docker for MacOS and VirtioFS 

For MacOS, if your Docker installation use VirtioFS, Cloudy Pad may fail with a Docker-related error such as: 

```
Error response from daemon: error while creating mount source path '/private/tmp/com.apple.launchd.ABCDEF/Listeners': mkdir /private/tmp/com.apple.launchd.ABCDEF/Listeners: operation not supported
```

This is a bug when using Docker for Mac VirtioFS file sharing with SSH agent. The bug is still being worked on, as a workaround you can either:

- Disable SSH agent before running Cloudy Pad, eg. `unset SSH_AUTH_SOCK`
- Switch Docker for Mac config to non-VirtioFS (eg. gRPC FUSE): go to _config > Resources > File Sharing_ and update config. 

## License

[GNU GENERAL PUBLIC LICENSE](./LICENSE.txt)