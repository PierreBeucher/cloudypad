# Cloudy Box 

Collection of Cloud components and services

_This project is under heavy development and will have breaking changes. Feel free to ping me an email or create an issue !_

## Features

**Gaming**

- 🐺 [Wolf](https://games-on-whales.github.io/wolf/stable/) Cloud instance
- 🌤️ (soon) [Sunshine](https://github.com/LizardByte/Sunshine) Cloud instance

**Coming soon**

- Deploy a fleet of instances with various services (VSCode, GPU, databases, etc.)
- Deploy Kubernetes clusters

## Usage

### General usage 

**Requirements**
- [Pulumi account](https://www.pulumi.com/) or [self-managed Pulumi backend](https://www.pulumi.com/docs/concepts/state/#using-a-self-managed-backend)
- [AWS](https://aws.amazon.com/) account

Only local usage is possible for now. A full binary package will be implemented soon.

```sh
# Show help
npx ts-node src/main.ts --help

# Deploy a Box (provision + configure)
npx ts-node src/main.ts deploy examples/gaming/wolf.yml

# Provision a Box
# Only run infrastructure provisioning 
# such as AWS resource management
npx ts-node src/main.ts provision examples/gaming/wolf.yml

# Configure a Box
# Only run Box configuration such as NixOS rebuild
npx ts-node src/main.ts configure examples/gaming/wolf.yml

# Get a Box details
npx ts-node src/main.ts get examples/gaming/wolf.yml

# Destroy a Box 
npx ts-node src/main.ts destroy examples/gaming/wolf.yml
```

### 🐺 Wolf 

Deploy a [Wolf](https://games-on-whales.github.io/wolf/stable/) Cloud instance:

```sh
# Deploy instance (provision + configuration)
npx ts-node src/main.ts deploy examples/gaming/wolf.yml

# Run only provision or configure steps
# npx ts-node src/main.ts provision examples/gaming/wolf.yml
# npx ts-node src/main.ts configure examples/gaming/wolf.yml
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
npx ts-node src/main.ts get examples/gaming/wolf.yml
```

Once deployed, run Moonlight and connect to instance. Open a browser to enter PIN with:

```sh
npx ts-node src/main.ts utils wolf open-pin examples/gaming/wolf.yml
```

Destroy instance - _⚠️ All data will be lost !_

```sh
npx ts-node src/main.ts destroy examples/gaming/wolf.yml
```

## Development

Test NixOS config

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