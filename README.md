# Cloudy Pad

Your own gaming box in the Cloud ! 🎮 ⛅ 

- [Development status 🧪](#development-status-)
- [Features ✨](#features-)
- [Getting started 🚀](#getting-started-)
  - [Installation](#installation)
  - [Create your Cloud gaming gear !](#create-your-cloud-gaming-gear-)
- [Usage and configuration](#usage-and-configuration)
  - [Default specs](#default-specs)
  - [Box configuration format](#box-configuration-format)
  - [Connect via SSH on Box](#connect-via-ssh-on-box)
  - [Set authorized SSH Keys](#set-authorized-ssh-keys)
  - [Setup a DNS record](#setup-a-dns-record)
- [Supported gaming servers and Cloud providers](#supported-gaming-servers-and-cloud-providers)
  - [Cloud providers 🌥️](#cloud-providers-️)
    - [AWS](#aws)
    - [Azure (not yet implemented)](#azure-not-yet-implemented)
    - [GCP (not yet implemented)](#gcp-not-yet-implemented)
    - [Other Cloud providers ?](#other-cloud-providers-)
  - [Gaming servers](#gaming-servers)
    - [Wolf 🐺](#wolf-)
    - [Sunshine 🌤️](#sunshine-️)
    - [Other Gaming servers ?](#other-gaming-servers-)
- [FAQ](#faq)
  - [How much will I pay ? 🫰](#how-much-will-i-pay--)
  - [How does Cloudy Pad works?](#how-does-cloudy-pad-works)
  - [Is it possible to deploy something else than Gaming servers ?](#is-it-possible-to-deploy-something-else-than-gaming-servers-)
  - [Will Cloudy Pad become a paid product ?](#will-cloudy-pad-become-a-paid-product-)
- [License](#license)

## Development status 🧪

This project is still at an experimental phase. While working and allowing you to play in the Cloud seamlessly, there may be breaking changes in the future. Feel free to contribute and provide feedback !

## Features ✨

Compatible with [Moonlight](https://moonlight-stream.org/) streaming client

Gaming servers:

- 🐺 [Wolf](https://games-on-whales.github.io/wolf/stable/)
- (available soon) 🌤️ [Sunshine](https://github.com/LizardByte/Sunshine)

Cloud providers:

- [AWS](https://aws.amazon.com/)
- (available soon) [Azure](https://azure.microsoft.com)
- (available soon) [Google Cloud](https://cloud.google.com)

## Getting started 🚀

Prerequisites:
- A Clouder account (eg. [AWS](https://aws.amazon.com/))
- Make sure you [understand the costs 💸](#how-much-will-i-pay--) of running a gaming instance in the Cloud

### Installation

_Note: installation is very basic for now, requiring to clone Git repo and build app. I'm actively working on npm and other distribution methods (eg. static binary, container image)._

Clone this Git repository:

```sh
git clone https://github.com/PierreBeucher/Cloudy-Pad.git
cd Cloudy-Pad
```

Build Cloudy Pad `cloudypad` CLI with either:

**🐳 Docker or Podman** 

Run :

```sh
docker compose run cloudypad
podman-compose run cloudypad
```

You'll be dropped into a shell with ready-to-use `cloudypad` CLI.

**🖥️ Build locally**

Make sure to have installed:
- [Pulumi](https://www.pulumi.com/docs/install/) 3.x or anterior
- [NodeJS](https://nodejs.org/en/download) 18.x or anterior
- [Typescript](https://nodejs.org/en/download) 5.x or anterior

Run:

```sh
npm install
npm run build
npm install -g
```

`cloudypad` CLI should now be available on path.

### Create your Cloud gaming gear !

Deploy a Wolf server on AWS:

```sh
cloudypad deploy examples/gaming/wolf-aws.yml
```

Once your instance is deployed and ready, use [Moonlight](https://moonlight-stream.org/) to access it. Get your instance IP or address with (it should be shown after deployment):

```sh
cloudypad get examples/gaming/wolf-aws.yml
```

Once Moonlight asks for PIN, open browser to PIN validation page with:

```sh
cloudypad utils wolf open-pin examples/gaming/wolf-aws.yml
```

**Remember to stop or destroy** your instance when done:

```sh
cloudypad stop examples/gaming/wolf-aws.yml
```

Start instance later with:

```sh
cloudypad start examples/gaming/wolf-aws.yml
```

Or destroy instance altogether (all data will be lost):

```sh
cloudypad destroy examples/gaming/wolf-aws.yml
```

## Usage and configuration

Cloudy Pad uses YAML configuration to manage your gaming box via CLI. See [examples](./examples/) configurations.

Basic commands:

```sh
# Show help
cloudypad --help

# Deploy a Box (provision + configure)
cloudypad deploy examples/gaming/wolf-aws.yml

# Provision a Box
# Only run infrastructure provisioning 
# such as AWS resource management
cloudypad provision examples/gaming/wolf-aws.yml

# Configure a Box
# Only run Box configuration (NixOS rebuild)
cloudypad configure examples/gaming/wolf-aws.yml

# Get a Box details
cloudypad get examples/gaming/wolf-aws.yml

# Destroy a Box 
cloudypad destroy examples/gaming/wolf-aws.yml
```

### Default specs

Default configuration per provider:

- AWS: `g5.xlarge` instance (16Gb RAM, 4 CPU, NVIDIA A10G Tensor Core), 150Go Disk, dynamic IP allocation
- Azure (available soon): 150Go Disk, dynamic IP allocation, instance type to be specified
- GCP (available soon): 150Go Disk, dynamic IP allocation, instance type to be specified

Boxes are customizable to specify instance types, disk size, DNS record, IP configuration and more ! (See below)

### Box configuration format

A box configuration is a YAML file looking like this:

```yaml
# Unique name for your Box
name: cloud-gaming-gear

# The box Kind 
# Only gaming.Wolf is supported for now, but more will come gaming.Sunshine 
kind: gaming.Wolf

# Box specifications
# A few technical details to know where and how to deploy your Box
spec: 
  ssh:
    authorizedKeys: 
    - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGaNlYLbwtAmfcNjlOsP6Ryh3QxGn9qlhlQjPo5nbzBa
  provisioner:
    aws: {}
```

### Connect via SSH on Box

Get your box details with:

```sh
cloudypad get examples/gaming/wolf-aws.yml
# Output something like

```

Then use ssh:

```sh
ssh root@<address>
```

### Set authorized SSH Keys

Specify authorized SSH keys:

```yaml
spec: 
  ssh:
    authorizedKeys: 
    - ssh-ed25519 AAA123...
    - ssh-ed25519 AAA456...
```

SSH keys will be added on next Box configuration.

### Setup a DNS record

_Note: you must own an Hosted Zone on the cloud Provider and have it configured accordingly. See provider doc for details._

```yaml
spec: 
  dns:
    zoneName: gaming.crafteo.io
```

Will create a DNS A record pointing to your instance. 

You can set detailed configuration:

```yaml
spec: 
  dns:
    zoneName: gaming.crafteo.io

    # Will create record mybox.gaming.crafteo.io 
    # instead of record at root on gaming.crafteo.io
    prefix: mybox

    # DNS Record Time-To-Live in seconds
    # Default to 60
    ttl: 3600
```

## Supported gaming servers and Cloud providers

### Cloud providers 🌥️

For now only AWS is supported, more will come soon !

#### AWS

Set `aws` provisioner in your Box config:

```yml
spec: 
  provisioner:
    aws: {}
```

You can also override the underlying provisioner config:

```yml
spec: 
  provisioner:
    aws:
      # Set AWS region and other configs
      config:
        region: eu-central-1
      
      # Set instance details
      instance:
        staticIpEnable: true,
        rootVolume: 
          sizeGb: 500
          type: g5.2xlarge
```

#### Azure (not yet implemented)

Set `azure` provisioner in your Box config:

```yml
spec: 
  provisioner:
    azure: {}
```

#### GCP (not yet implemented)

Set `gcp` provisioner in your Box config:

```yml
spec: 
  provisioner:
    gcp: {}
```

#### Other Cloud providers ?

Indeed, AWS/GCP/Azure are expensive for a gaming box. 

This project aim to support cheaper Cloud providers like [Paperspace](https://www.paperspace.com/) or [TensorDock](https://www.tensordock.com/) (if you're curious you can find an experimental Paperspace box hidden in the code, though it's not fully working yet). Do not to hesitate to contribute or ⭐ the project, it will help move things forward !

### Gaming servers

#### Wolf 🐺

[Wolf](https://games-on-whales.github.io/wolf/stable/index.html) is _an open source streaming server for Moonlight that allows you to share a single server with multiple remote clients in order to play videogames_. It works via containers to provide various services such as Steam Big Picture.

#### Sunshine 🌤️

[Sunshine](https://github.com/LizardByte/Sunshine) is a _self-hosted game stream host for Moonlight_. You can install anything on your instance (eg. Steam or other) and stream it with Moonlight.

#### Other Gaming servers ?

This project intend to support [Parsec](https://parsec.app/). Feel free to propose other gaming servers !

## FAQ

### How much will I pay ? 🫰

Cloudy-Pad is free and open-source, however charges may apply when using a Cloud provider. Here's an estimation for AWS:

| Gaming time / month      | 15h        | 20h        | 20h        | 30h        |
|--------------------------|------------|------------|------------|------------|
| EC2 instance type        | g5.xlarge  | g5.xlarge  | g5.2xlarge | g5.2xlarge |
| Disk size (gp3 SSD)      | 100 Go     | 100 Go     | 100 Go     | 100 Go     |
| EC2 instance $           | $18.87     | $25.16     | $30.31     | $45.47     |
| Route53 record $         | $0.00      | $0.00      | $0.00      | $0.00      |
| EC2 volume (disk) $      | $9.52      | $9.52      | $9.52      | $9.52      |
| EIP address $            | (no eip)   | $3.50      | (no eip)   | $3.45      |
| **Est. TOTAL / month $** | **~$28** | **~$38** | **~$40** | **~$58** |

_*Estimation based on eu-central-1 (Frankfurt) pricing in December 2023. Exact prices vary with time and regions._

**This project's goal is to provide 20h / month for 20$** - [Paperspace](https://www.paperspace.com/pricing) and [TensorDock](https://www.tensordock.com/) are good bets, but not ready to use yet.  

Equivalent estimation for other providers will be added as they become ready.

### How does Cloudy Pad works? 

Deployment is divided in two phases:

- Provisioning: manage Cloud resources (virtual machines, firewall, volumes disks, etc.)
  - Currently managed via [Pulumi](https://www.pulumi.com/)
- Configuration: install everything on instance (gaming server, GPU drivers, etc.)
  - Currently managed via [NixOS](https://nixos.org/)

A small framework, **Cloudy Box**, allow seamless integration of both technologies. 

### Is it possible to deploy something else than Gaming servers ?

Yes ! Underlying Cloudy Box framework is actually designed for that: easy deployment of Cloud infrastructure with NixOS (or other configuration tools). In the future it will be merged-out of this project to become a more generic Cloudy Box CLI and/or API project which Cloudy Pad will use. 

If you're interested in these features, do not hesitate to reach me directly - my email is on my GitHub account. 

### Will Cloudy Pad become a paid product ?

Probably not in it's current form. Considering I'm really _not_ happy about the [enshittification of the internet](https://en.wikipedia.org/wiki/Enshittification), Cloudy Pad will remain FOSS - at least for personal use.

However, the larger Cloudy Box scope may become a paid product for professional use cases, not necessarily linked to gaming.

## License

[GNU GENERAL PUBLIC LICENSE](./LICENSE.txt)