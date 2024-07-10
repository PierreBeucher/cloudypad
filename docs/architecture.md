# CloudyBox architecture and code design

## Concepts

### Project & Box

CloudyBox revolves around the concept of **Box** to manage infrastructure provisioning, configuration or both. Boxes are deployed via a **Project**. 

Projects are the main interface to deploy Boxes as they define. A project is defined by:
- **Kind**: the project kind, eg. `Linux.NixOS` to deploy one or more NixOS instances
- **Name**: unique project name. A project's Kind an have multiple instances, each with a unique Name. 
- **Spec**: project's specification, eg. desired number of replicas, NixOS version, etc.

These aspects are today represented via YAML file such as:

```yaml
# NixOS project named "my-nixos-fleet" with ssh keys and AWS provisioner
# Deploy 2 NIxOS instances on AWS using a t3.medium instance 
# and use Nix to configure Docker on each instance
name: my-nixos-fleet
kind: Linux.NixOS
spec:
  nixos:
    nixosChannel: nixos-23.11
    modules:
    - path: examples/nixos/modules/docker.nix
  replicas:
  - baba
  - jiji
  ssh:
    authorizedKeys: 
    - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGaNlYLbwtAmfcNjlOsP6Ryh3QxGn9qlhlQjPo5nbzBa
    - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFCaDcbK5+r0s0cbl9RC1kKDr0p3vJfErE6RIOwNeXEP
  provisioner:
    aws:
      instance:
        type: t3.medium
```

**Box implement the `spec`** of a Project. In example above, a `NixOSManagerBox` will ensure AWS instances of specified type are provisioned and configured with expected NixOS channel and modules. 

### Box and child Boxes

A Project is linked directly to a single Main Box, eg. a `Linux.NixOS` Project uses directly a `NixOSManagerBox` which is its main Box. 

A Box can have one or more child Boxes. This pattern allow modularity, genericity and construction of complex behavior. For example, a `NixOSManagerBox` may have a few child Boxes depending on spec such as a `ReplicatedEC2ProvisionerBox` to provision AWS instance and one or more `NixOSConfiguratorBox` to configure NixOS instances. 

A Box can be of 3 types:

- **Manager Box**: handle the entire lifecycle of a piece of infrastructure: provision and configuration. For example, the `NixOSManagerBox` manages the provisioning of Cloud VM(s) and their internal NixOS configuration.
- **Configurator Box**: handle only the configuration for a piece of infrastructure. For example, the `NixOSConfiguratorBox` will only manage NixOS configuration for an existing machine, but won't manage provisioning of the machine itself.
- **Provisioner Box**: handle only the provisioning of some piece of infrastructure. For example, the `ReplicatedEC2ProvisionerBox` deploys virtual machines on AWS without configuring what's installed on the VMs.

## Cloud resources naming conventions

CloudyBox provison resources on Cloud. To help organizing things, resources are named following these conventions where possible:

```
CloudyBox-<Kind>-[<ProjectName>[-<Suffix>]]
```

Where: 
- _Kind_ and _ProjectName_ represent the project's kind and name
- _Suffix_ may be added on some resources to better represent their use case within a project or box

For example, considering above `my-nixos-fleet` project (of kind `Linux.NixOS`), these resources will be created:

- A Pulumi project `CloudyBox-Linux.NixOS` with name `my-nixos-fleet`
  - [Pulumi](https://www.pulumi.com/) is a FOSS Infrastructure as Code tool leveraged by CloudyBox to provision infrastructure on the Cloud.
  - Why not name Pulumi project `CloudyBox-Linux.NixOS-my-nixos-fleet` ? Because a Pulumi project is much like a CloudyBox project and can have multiple "stacks". Hence CloudyBox use a single _Pulumi project_ per _CloudyBox Project Kind_ and leverage Pulumi "stacks" for each project instances. 
- AWS instances named `CloudyBox-Linux.NixOS-my-nixos-fleet-baba` and `CloudyBox-Linux.NixOS-my-nixos-fleet-jiji`
  - `baba` and `jiji` are suffix given to instances as it made sense in this context to differentiate them