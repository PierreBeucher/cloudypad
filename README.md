# Cloudy Pad

Your own gaming gear in the Cloud ! 🎮 ⛅ 

- [Development status](#development-status)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [General](#general)
  - [🐺 Wolf](#-wolf)
  - [❄️ NixOS instance fleet](#️-nixos-instance-fleet)
- [Example configurations](#example-configurations)
- [Development](#development)
  - [Test NixOS config](#test-nixos-config)
  - [Generate Paperspace client](#generate-paperspace-client)

## Development status

This project is still at an experimental phase. While working and allowing you to play in the Cloud seamlessly, there may be breaking changes in the future. Feel free to contribute and provide feedback !

## Features

**Gaming**

- 🐺 [Wolf](https://games-on-whales.github.io/wolf/stable/) Cloud instance
- 🌤️ (soon) [Sunshine](https://github.com/LizardByte/Sunshine) Cloud instance

**❄️ NixOS**

- [NixOS](https://nixos.org/) instance fleet for various usage: VSCode Server, Docker, etc. 

**Coming soon**

- Deploy a fleet of instances with various services (VSCode, GPU, databases, etc.)
- Deploy Kubernetes clusters

## Installation

Clone this repository and install globally:

```sh
npm i -g
```

Package will soon be published publicly to npm registry.

## Usage

All command below use `cloudybox`. You can also use `npx ts-node src/main.ts` without global installation.

### General

**Requirements**
- [Pulumi account](https://www.pulumi.com/) or [self-managed Pulumi backend](https://www.pulumi.com/docs/concepts/state/#using-a-self-managed-backend)
- [AWS](https://aws.amazon.com/) account

```sh
# Show help
cloudybox --help

# Deploy a Box (provision + configure)
cloudybox deploy examples/gaming/wolf.yml

# Provision a Box
# Only run infrastructure provisioning 
# such as AWS resource management
cloudybox provision examples/gaming/wolf.yml

# Configure a Box
# Only run Box configuration such as NixOS rebuild
cloudybox configure examples/gaming/wolf.yml

# Get a Box details
cloudybox get examples/gaming/wolf.yml

# Destroy a Box 
cloudybox destroy examples/gaming/wolf.yml
```

### 🐺 Wolf 

Deploy a [Wolf](https://games-on-whales.github.io/wolf/stable/) Cloud instance:

```sh
# Deploy instance (provision + configuration)
cloudybox deploy examples/gaming/wolf.yml

# Run only provision or configure steps
# cloudybox provision examples/gaming/wolf.yml
# cloudybox configure examples/gaming/wolf.yml
```

Deployment will take care of everything: machine provisioning, configuration, driver installation...

Output shows something like:

```json
{
  "replicas": [
    {
      "name": "instance",
      "publicIp": "3.73.159.77",
      "instanceId": "i-08f25ac5ab47afa79"
    }
  ]
}
```

Alternatively get instance details with

```sh
cloudybox get examples/gaming/wolf.yml
```

Once deployed, run Moonlight and connect to instance. Open a browser to enter PIN with:

```sh
cloudybox utils wolf open-pin examples/gaming/wolf.yml
```

Destroy instance - _⚠️ All data will be lost !_

```sh
cloudybox destroy examples/gaming/wolf.yml
```

### ❄️ NixOS instance fleet

Deploy a fleet of [NixOS](https://nixos.org/) instances for various use cases: development server with VSCode and Docker, database server, Wordpress website...

```sh
cloudybox deploy examples/nixos/replicated.yml
```

## Example configurations

See [examples](./examples/)

## Development

### Test NixOS config

```sh
nix-instantiate '<nixpkgs/nixos>' -A config.system.build.toplevel -I nixpkgs=channel:nixos-23.05 --arg configuration ./configs/nix/wolf-aws.nix
```

Manage underlying Pulumi stacks:

```sh
pulumi stack ls -a
pulumi destroy -s full-stack-name
pulumi stack output -s full-stack-name
pulumi stack rm full-stack-name
```

### Generate Paperspace client

Paperspace client is generated from OpenAPI specifications:

```sh
task paperspace-client-gen
```