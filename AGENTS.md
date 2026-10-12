# Cloudy Pad Core - Agent instructions

- [General](#general)
- [Glossary](#glossary)
- [Cloudy Pad Core architecture overview](#cloudy-pad-core-architecture-overview)
- [Instance lifecycle and Core components](#instance-lifecycle-and-core-components)
- [Instance resources](#instance-resources)
- [Instance lifecycle phases](#instance-lifecycle-phases)
  - [Instance State](#instance-state)
- [Code and components](#code-and-components)
  - [Provider implementation](#provider-implementation)
- [Source code files and organization](#source-code-files-and-organization)
- [Coding rules](#coding-rules)
  - [Coding best practice](#coding-best-practice)
  - [Code architecture](#code-architecture)
  - [Writing code and test](#writing-code-and-test)
- [Commands](#commands)
  - [ALWAYS run commands under a Nix development shell](#always-run-commands-under-a-nix-development-shell)
  - [Task files](#task-files)

## General

Most of the time you'll be asked to code:
- Go straight to code. Do not start with "I'm gonna bla bla bla" and do not end with a summary of what you've done. Just write code and update files, no chitchat. 
- Do not summarize what you did. When you finished, no more output - unless I specifically asked for details or a plan

## Glossary

- Cloudy Pad - the project name. Deploy and manage Cloud-based gaming machines where users can install their own games (Steam, Lutris, etc.) and use a client to stream video games from powerful Cloud machines to their own machine. Users can play games with high quality and performance games, typically Windows games, from any machine (MacOS, less powerful Windows machines, Linux, tablet, phones....) Provides a CLI and let user customize their settings (instance type, disk size, etc.). "Cloudy" as everything happens in the Cloud. "Pad": a way to call video game controller.
- Instance - a Cloudy Pad instance. "Instance" represent overall instance components: its infrastructure (servers, disk, etc.), internal State, status and everything associated.
- Instance Server - The Cloud server / machine / VM for an instance. 
- Instance State - Cloudy Pad internal state for an instance with its Inputs (provider, instance server type, disk size...) and Outputs (concrete server ID, known hostname / IP address...). Represented as a YAML file in a State Backend written by Side Effects. In code as `InstanceStateV1` and extending classes per providers. 
- Cloudy Pad config - Global configuration object used by components. Define State backend (side effect to use), Pulumi config, etc.
- Provider - A Cloud provider like AWS, Azure, GCP, Scaleway, Paperspace...  
- Side Effect - Name given to classes used to read/write Instance States on local files / S3 / ...
- Instance Initializer / initialization: Initialization of an Instance means creating the Instance initial state and persisting via a Side Effect. After Initialization, Instance State is valid with all required Inputs but no Output as provisioning and configuration is not done yet.
- Instance Provisioner / provisioning - Provision an instance Cloud infrastructure: instance server, IP address, disks, etc. and destroy it.
- Instance Configurator / configuration: Configure an instance server: OS config, NVIDIA drivers, Cloudy Pad installation, etc. Typically via Ansible. 
- Instance Runner - Manage instance runtime lifecycle: start/stop/restart, get status, etc.
- Instance Updater
- Instance Manager - High-level component to manage an instance after initialization: start/stop/restart, provision, configure, destroy...
- Streaming server - Streaming server installed on instance server to stream video and inputs from/to client's machine. Either Sunshine or Wolf. 
- Moonlight - Streaming client compatible with Sunshine and Wolf. An application installed on user's machine which can be connected (paired) to an instance streaming server.
- Sunshine - A streaming server https://github.com/LizardByte/Sunshine
- Wolf - A streaming server https://games-on-whales.github.io/wolf/stable/
- pair / instance pairing - Act of pairing Moonlight with a streaming server. Involves user entering a PIN between client and server to establish a trust relationship between both. Once paired, a client can connect and stream from the instance server. 
- MoonlightPairer - Implement pairing process for streaming servers 

## Cloudy Pad Core architecture overview

You must respect architecture patterns and each component responsibility when coding:

Cloudy Pad Core components:

- **Core** - Internal, Cloud-agnostic components to manage overall instances and deployment.
- **Provider implementations** - implementation Core components for various Cloud Providers
  - For example `aws` Provider is the implementation of instance deployment on AWS
- **CLI** - Wrapper around Core components to provide the Cloudy Pad CLI with interactive prompts

## Instance lifecycle and Core components


## Instance resources

An instance is comprised of:
- Server: the Cloud server or machine on which our games will run
- Base image: a Server base image (or root disk, OS disk, system disk, term may vary with Cloud providers) with Cloudy Pad pre-installed with NVIDIA drivers, etc. from which a Server can be created or booted. 
- Data Disk and Data Disk snapshot: user's data stored on a dedicated disk, independent from Base image
- IP address or hostname: the public IP or hostname address for the instance
- Depending on Cloud provider, an Instance may also need a VPC or network, a firewall, etc. 

## Instance lifecycle phases

Initialization:

- State initialization - A state is initialized with Inputs (eg. Cloud provider, instance type, disk size, etc.)
- Deployment - Initial deployment for an instance
  - Provision - Provision Cloud resources: server, disk, IP address...
  - Configuration - Runs Ansible configuration on instance (NVIDIA driver install, Docker container deployment...)
  - Base image snapshot - Create a base image of the instance server
  - Data disk snapshot - Create a snapshot of data disk
- Pairing (optional): it's possible to pair instance with Moonlight right after initial deployment

Once fully initialized, possible actions on instances:

- Start - start an instance by:
  - Provision: create instance server from Base image, restore Data disk from Snapshot and attach Data disk
  - Quick Configuration: mount data disk, re-deploy containers and other start-specific actions
- Stop  
  - Stop the instance server
  - Provision: delete instance server, update Data disk snapshot from existing Data disk and remove Data disk
- Restart
  - Reboot instance server. Don't run provision or configuration again since server isn't deleted. 

It's also possible to run actions independently:
- Configuration: Run a full Ansible configuration
- Provision: Run a full Provision cycle based on latest instance state
  - eg. if latest instance state is Stopped, will run provision to ensure a Stopped state
- Deployment: 
  - Run a full provision and configuration of instance (starting it as needed), effectively updating Base image

### Instance State

The Instance State represents the state in which an instance is. It roughly contains:
- Instance name
- Provider name (AWS, Azure, etc.)
- Inputs: desired instance configurations (instance type, region, streaming server, etc.)
- Outputs: actual infrastructure state (disk storage unique ID, IP address, etc.)

Each Provider implements its own state interface based on a common State implementation. State is by default persisted as a local YAML file under `~/.cloudypad/instance/<name>/state.yml`

Example State file:

```yaml
name: aws-instance
version: '1'

# Provision inputs and outputs
provision:
  provider: aws # provider name

  # Desired instance state for AWS
  input:
    diskSize: 200
    instanceType: g4dn.2xlarge
    publicIpType: static
    region: eu-central-1
    ssh:
      user: ubuntu
      privateKeyContentBase64: xxx
  
  # Actual infrastructure state
  # for AWS, host is instance static IP address and instanceId the EC2 instance ID
  output:
    host: 18.199.182.227
    instanceId: i-0ae901f1799b17fdf

# Configuration inputs and outputs
# used to configure instance
configuration:
  configurator: ansible
  input:
    sunshine:
      enable: true
      passwordBase64: xxx
      username: sunshine
```

As state is written and read externally, [Zod](https://zod.dev/) is used to enforce TypeScript typing.

## Code and components

Related code:

- `core/initializer.ts` - `InstanceInitializer` - Manage overall initialization and deployment with `InstanceManager`
- `core/manager.ts` - `InstanceManager` - Centralize management logic for instances:
  - Define top-level `deploy()`, `provision()`, `start()`, etc. using underlying Provisioner, Configurator and Runner
  - Read and Write the instance State. This is the ONLY component that can manage state through `StateWriter`. Other components are passed State via the Manager.
  - Update State outputs depending on action results (eg. add Provision output after provisioning)
  - Can update State some inputs during deployment (eg. instance desired state)
- `core/provisioner.ts` - `InstanceProvisioner` - Manages Cloud provision: instance server deployment, data disk snapshot, base image creation/update, etc. via specialized Pulumi stacks
- `core/configurator.ts` - `InstanceConfigurator` - Configure an instance. Only Ansible supported for now.
- `core/runner.ts` - `InstanceRunner` - Manages instance server plain start/stop actions (eg. stop an AWS EC2 machine)
- `core/moonlight/pairer.ts` - `MoonlightPairer` - Pair instances with Moonlight by sending PIN from user input.
- `core/state` - State implementation and related classes (eg. StateWriter). State can use various backends (Local, S3...)

### Provider implementation

A Provider is a specialization of Core components to deploy instances in a given context, typically for a Cloud provider. For example: `provider/scaleway` Provider is the implementation of instance deployment on Scaleway.

Each provider is based on the same pattern:

- `pulumi/[STACK].ts` - Pulumi stacks dedicated to:
  - Main provision (instance server, data disk, etc.)
  - Base image
  - Data disk snapshot
  - _Note: not all providers implement every stack. Example: SSH provider doesn't use Pulumi. Linode provider doesn't have data disk snapshot._
- `state.ts` - Extends `InstanceStateV1` with Inputs and Outputs specific to this provider
- `provisioner.ts` - Implements `InstanceProvisioner` for this provider. Use State Inputs to configure and run Pulumi stacks (or create infra with Provider API directly)
- `runner.ts` - Implements `InstanceRunner` for this provider. Use a Provider specific client to call Provider API to start/stop/... instance infrastructure. 
- `cli.ts` - CLI implementation for this provider. Define Provider specific CLI args and command implementation (e.g. `create` arguments which are specific per providers)
- `sdk-client.ts` - or in a `client/` folder. Provider specific SDK clients to interact with various resources (get server status, list available regions, etc.)

More internal-oriented files:

- `provider.ts` - Implements `ProviderClient` for this Provider.
- `factory.ts` - Implements `ProvisionerFactory` for this Provider. 

## Source code files and organization

- `src/`
  - `core/` - System central logic with abstract components used by providers
    - `client.ts` - `CloudypadClient` class to manage high-level generic functions like `getAllInstances()` or `instanceExists()`
    - `config/` - Core configuration interface `CoreConfig`, default value and loading methods. `CoreConfig` is passed to components to define their behavior (eg. State Backend used, Pulumi config, etc.)
      - `default.ts`
      - `interface.ts`
    - `state/` - Instance State implementation. State are objects representing an instance state: inputs, outputs, providers used, etc.States are written and read using a Side Effect (local file, S3, etc.) as YAML files. Various State Manager components manage state: Loader to read, Writer to write, Parser to check format using Zod. 
      - `state.ts` - Instance representation `InstanceStateV1` with Inputs (provider to use, provider config, instance type, data disk size, etc.), Outputs (concrete instance ID, data disk ID, etc.) and recent events (start-begin, start-end, provision-begin, etc.). Each provider implements its own State format with specific Inputs and Outputs
      - `builders.ts` - Build State Managers using provided `CoreConfig`
      - `initializer.ts` - Generic `StateInitializer` class to initialize states for a given provider (a specific State implementation)
      - `loader.ts` - Read States from Side Effects 
      - `parser.ts` - Parse given States. Generic Parser and Providers extend to implement their own Parsers
      - `side-effects/` - Implement Side effects (S3, Local...) from an abstract class.
      - `writer.ts` - Write State to specified Side Effect
    - `initializer.ts` - Generic class to Initialize Instances. Leverages StateInitializer.
    - `manager.ts` - High-level `InstanceManager` (provider agnostic) to manage instance lifecycle after initialization leveraging sub-classes to provision/destroy (`InstanceProvisioner`), configure (`InstanceConfigurator`), start/stop/restart/get status (`InstanceRunner`)
    - `provisioner.ts` - `InstanceProvisioner` to Provision an Instance by running Pulumi (or creating infrastructure using Cloud Provider API directly). Each Providers extends to implement their own.
    - `configurator.ts` - `InstanceConfigurator` to Configure an instance after Provisioning: OS config, Cloudy Pad installation... Using Ansible for all providers.
    - `runner.ts` - `InstanceRunner` to manager an Instance running status: start/stop/restart/get status and details. Each Providers extends to implement their own.
    - `updater.ts` - `InstanceUpdater` to Update an Instance State. 
    - `const.ts` - Global constants like Provider names `CLOUDYPAD_PROVIDER_AWS="aws"`, `CLOUDYPAD_VERSION`, etc.
    - `manager-builder.ts` - Build `InstanceManager`s for existing Instances.
    - `moonlight/`
      - `pairer`
    - `provider.ts` - Define `ProviderClient` abstract class each Provider extends to implement `getInstanceInitializer()`, `getStateWriter()` and related function to generate provider-specific Initializer, Provisioner, Configurator, Runner, Updater, StateWriter, StateParser, etc. 
    - `submanager-factory.ts` - `ProvisionerFactory` for sub-managers used by `InstanceManager`:  Runners, Configurators, Provisioner
  - `cli/` - Wrap Core components around a CLI
    - `command.ts` - Define global CLI args format and function to generate commands
    - `config.ts` - CLI specific config
    - `initializer.ts` - CLI wrapper around Core Initializer
    - `main.ts` - CLI main executable
    - `program.ts` - Define CLI program and available commands like `start`, `create` per provider, etc.
    - `prompter.ts` - Abstract class to prompt user and transform CLI args into Instance State Inputs 
    - `updater.ts` CLI wrapper around Core Updater
  - `configurators/` - Core Configurators implementation. Only Ansible exists for now.
    - `ansible.ts` - Core Configurator Ansible implementation
  - `index.ts` - Index file with global exports
  - `log/` - Logging utils, including `getLogger(name: string)` and `Logger` used as logging mechanism by components. Use this method to get a Logger instance.
    - `utils.ts`
  - `providers/` - Providers implementation. Each Provider has the same structure to extend Core components, only AWS is documented explicitly for brevity.
    - `aws/`
      - `state.ts` - Extends `InstanceStateV1` with Inputs and Outputs specific to this provider
      - `provisioner.ts` - Implements `InstanceProvisioner` for this provider. Use State Inputs to configure and run Pulumi stacks (or create infra with Provider API directly)
      - `runner.ts` - Implements `InstanceRunner` for this provider. Use a Provider specific client to call Provider API to start/stop/... instance infrastructure. 
      - `cli.ts` - CLI implementation for this provider. Define Provider specific CLI args and command implementation (eg. `create` arguments which are specific per providers)
      - `factory.ts` - Implements `ProvisionerFactory` for this Provider. (TODO this can probably be merged into `provider.ts`)
      - `pulumi.ts` - Implements Pulumi stack for this provider. 
      - `provider.ts` - Implements `ProviderClient` for this Provider.
      - `sdk-client.ts` - or in a `client/` folder. Provider specific SDK clients to interact with various resources (get server status, list available regions, etc.)
    - `azure/` - Microsoft Azure
      - `cli.ts`
      - `factory.ts`
      - `provider.ts`
      - `provisioner.ts`
      - `pulumi.ts`
      - `runner.ts`
      - `state.ts`
      - `sdk-client.ts`
    - `dummy/` - Dummy provider for testing purposes. Used in Unit Tests. Fully implement all provider but simulates provisioning and configuration, otherwise use a real State with usual side effects and overal implementation. Provisioning updates State with a `dummyInfrastructure` field in state representing current infra status (eg. dummy server ID, dummy disk ID...) rather than call a real Provider API or Pulumi. Configurator is a no-op (only logs), Ansible does not run. 
      - `cli.ts`
      - `configurator.ts`
      - `factory.ts`
      - `infra.ts` - manages Dummy infrastructure in State
      - `provider.ts`
      - `provisioner.ts`
      - `runner.ts`
      - `state.ts`
    - `gcp/` - Google Cloud Platform
      - `cli.ts`
      - `factory.ts`
      - `provider.ts`
      - `provisioner.ts`
      - `pulumi.ts`
      - `runner.ts`
      - `state.ts`
      - `sdk-client.ts`
    - `paperspace/` - Paperspace - do not use Pulumi but direct Paperspace API call for provisioning.
      - `client/`
      - `cli.ts`
      - `factory.ts`
      - `provider.ts`
      - `provisioner.ts`
      - `runner.ts`
      - `state.ts`
      - `client/`
    - `scaleway/` - Scaleway
      - `cli.ts`
      - `factory.ts`
      - `provider.ts`
      - `provisioner.ts`
      - `pulumi.ts`
      - `runner.ts`
      - `state.ts`
      - `sdk-client.ts`
  - `tools/` - Various tools and utils
    - `analytics/` - Analytics client to generate usage events and tracking
      - `client.ts`
      - `events.ts`
      - `initializer.ts`
      - `manager.ts`
    - `ansible.ts` - Ansible client used by Ansible configurator. Runs `ansible-playbook` sub-process.
    - `aws.ts` - AWS Client wrapping AWS SDK with utility methods.
    - `axios.ts` - Axios utils, mostly handle errors for Axios return values
    - `azure.ts` - Azure Client wrapping Azure SDK with utility methods.
    - `base64.ts` - Base64 utils
    - `gcp.ts` - GCP Client wrapping GCP SDK with utility methods.
    - `pulumi/`
      - `client.ts` - Pulumi Client wrapping Pulumi Automation API. Defines `InstancePulumiClient` extended by Provider's Pulumi stacks.
    - `s3.ts` - S3 client wrapping AWS S3 SDK.
    - `scaleway.ts` - Scaleway Client wrapping Scaleway SDK with utility methods.
    - `ssh.ts` - SSH client wrapping NodeSSH library.
    - `user-config-detector.ts` - Auto-detect user current config (keyboard layout, etc.)

## Coding rules

Coding rules for writing code and test and running basic testing and feedback commands

### Coding best practice

- Always respect Typescript typing. Never use `any` or such unless specifically allowed
- Avoid construct setting variables in cascade for a single usage, eg:
```ts
// don't chain const like this if anotherSubVar is only used once, this is uselessly verbose
const someVar = this.foo.bar.baz
const anotherSubVar = someVar.a.b.c
function(anotherSubVar)

// do
function(this.foo.bar.baz.a.b.c)
```

### Code architecture 

Always consider the overall code Architecture described in the "Cloudy Pad Core architecture overview" section above

### Writing code and test

When you write new code, ALWAYS follow this workflow unless specifically asked otherwise:

- Start by writing unit tests under `test/unit` for related component if applicable
  - Any modification of `src/**` is most likely to have an impact on unit tests
- Write the code 
- First run test only for impacted component(s) with command such as `task test-unit -- test/unit/core/updater.spec.ts` 
  - you can run multiple commands for multiple files 
  - Even run for a folder with `task test-unit -- test/unit/core`
- Adapt and fix accordingly: update code and re-run tests until it works
  - If you become stuck  or see you can't get over a problem after a few attempts, stop and ask for help

## Commands

How to run commands for testing, compilation and other things

### ALWAYS run commands under a Nix development shell

When you run command, ALWAYS execute it under a Nix development shell unless specifically asked otherwise.

Example: you are asked to run `task test-unit`, do NOT run directly:

```sh
# Don't run plainly like this
task test-unit
```

Instead, run `nix develop -c [COMMAND]` without quotes:

```sh
nix develop -c task test-unit
# do not use quote, eg. not this: nix develop -c "task test-unit"
```

Nix development shell will provide binaries and environment variables suitable for this project. Without it, you may be missing important tools and binaries. 

### Task files

Most commands can be run as a task from Taskfile.yml at project root, for example checking no obvious thing broke after an update:

```sh
# List all tasks
task -a

# Quick compilation and syntax check
task test-compile

# Unit tests
task test-unit
```

Considering above statement, these must be run as `nix develop -c task ...` of course.
