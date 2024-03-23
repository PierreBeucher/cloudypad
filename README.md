# Cloudy Box 

Collection of Cloud components and services

_This project is under heavy development and will have breaking changes. Feel free to ping me an email or create an issue !_

## Features

**Gaming**

- 🐺 Deploy a [Wolf](https://games-on-whales.github.io/wolf/stable/) instance in the Cloud
- 🌤️ (soon) Deploy a [Sunshine](https://github.com/LizardByte/Sunshine) instance in the Cloud

**Coming soon**

- Deploy a fleet of instances with various services (VSCode, GPU, databases, etc.)
- Deploy Kubernetes clusters

## Usage


**Requirements**
- [Pulumi account](https://www.pulumi.com/) or [self-managed Pulumi backend](https://www.pulumi.com/docs/concepts/state/#using-a-self-managed-backend)
- [AWS](https://aws.amazon.com/) account

Only local usage is possible for now. A full binary package will be implemented soon.

```sh
npx ts-node cli/src/main.ts --help
npx ts-node cli/src/main.ts deploy dev
npx ts-node cli/src/main.ts provision dev
npx ts-node cli/src/main.ts get dev
npx ts-node cli/src/main.ts destroy dev
```

### Wolf

Deploy a Wolf gamin instance on AWS:

```sh
# Deploy Wolf instance
# Will also run provision
npx ts-node cli/src/main.ts deploy dev

# If needed, run only provision
#npx ts-node cli/src/main.ts provision dev

# If needed, get instance details (IP address for Moonlight)
# npx ts-node cli/src/main.ts get dev
```

Run Moonlight and connect to instance:

```sh
moonlight
```

Open browser to enter Moonlight server-side PIN:

```sh
npx ts-node cli/src/main.ts utils wolf open-pin
```

Destroy instance:

```sh
npx ts-node cli/src/main.ts destroy dev
```

## Development

Test NixOS config

```sh
nix-instantiate '<nixpkgs/nixos>' -A config.system.build.toplevel -I nixpkgs=channel:nixos-23.05 --arg configuration ./provision/nix/wolf-aws.nix
```