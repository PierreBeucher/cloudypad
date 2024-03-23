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
npx ts-node cli/src/main.ts deploy examples/wolf.yml
npx ts-node cli/src/main.ts provision examples/wolf.yml
npx ts-node cli/src/main.ts configure examples/wolf.yml
npx ts-node cli/src/main.ts get examples/wolf.yml
npx ts-node cli/src/main.ts destroy examples/wolf.yml
```

### Wolf

Deploy a Wolf gaming instance on AWS:

```sh
# Deploy Wolf instance
npx ts-node cli/src/main.ts deploy examples/wolf.yml

# Run only provision or configure steps
npx ts-node cli/src/main.ts provision examples/wolf.yml
npx ts-node cli/src/main.ts configure examples/wolf.yml

# Get box details (IP address for Moonlight)
npx ts-node cli/src/main.ts get examples/wolf.yml
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
nix-instantiate '<nixpkgs/nixos>' -A config.system.build.toplevel -I nixpkgs=channel:nixos-23.05 --arg configuration ./configs/nix/wolf-aws.nix
```