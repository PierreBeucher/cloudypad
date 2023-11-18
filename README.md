# Cloudy Sunshine 

Sunshine on AWS Cloud !

## Requirements

- [Nix](https://nixos.org/download)
- Access to an AWS account with read/Write permissions on EC2 & Route53

That's all :) Nix will provide every needed binary: AWS CLI, NodeJS, Pulumi, etc. 

## Usage

Every commands must bu run under Nix shell. Start Nix shell with

```
nix develop
```

### Initial setup

Deploy an AWS GPU instance and configure Sunshine server

Create stack config file from template. Example use `mystack` name

```sh
cp infra/Pulumi.template.yaml cp infra/Pulumi.mystack.yaml
```

Update `Pulumi.mysunshine.yaml` as needed and deploy infra

```
make infra
```

Wait for instance to start and configure it with Nix

```
make nixos-config
```

Once configured, reboot

```
make reboot
```

Sunshine server should now start with instance.

Access Sunshine server using Hosted Zone or FQDN from `Pulumi.mystack.yaml` on port `47990`, for example:

```
https://small.sunshine.mydomain.org:47990/
```

Run Moonlight and connect to your instance. You'll need to validate PIN on first usage

```
moonlight
```

## Everyday usage

Start instance

```
make start
```

Run Moonlight and connect to your instance

```
moonlight
```

Once finished, **remember to stop instance to avoid unnecessary costs**

```
make stop
```

## Development

Debugging commands:
 
```sh
# Show sunshine user journal (e.g. sunshine server logs)
journalctl _UID=1000 -b
```