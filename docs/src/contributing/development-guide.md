# Development guide

- [Release](#release)
  - [Before release testing](#before-release-testing)
  - [Do release](#do-release)
- [Tests](#tests)
  - [Unit tests](#unit-tests)
  - [Integration tests](#integration-tests)
  - [Development](#development)
    - [Various dev tasks](#various-dev-tasks)
    - [Development Virtual Machine](#development-virtual-machine)
  - [Local Pulumi stack manipulation](#local-pulumi-stack-manipulation)
- [Maintenance](#maintenance)
- [Regular updates](#regular-updates)
  - [Updating Wolf version](#updating-wolf-version)
- [Adding a new provider](#adding-a-new-provider)
  - [Provider components](#provider-components)
  - [Integrate provider in Core](#integrate-provider-in-core)
  - [Tests](#tests-1)
- [Adding new CLI args](#adding-new-cli-args)

## Release

### Before release testing

Some tests are required before release:

- [ ] `task test-unit` (done by CI)
- [ ] `task test-integ-full-lifecycle-all` (done manually since it requires real Cloud accounts)
- [ ] `task test-integ-scaleway-lifecycle-with-server-deletion` (done manually since it requires real Cloud accounts)

### Do release

Set `export GITHUB_TOKEN=xxx` variable and run:

```sh
# Will prompt for details and describe required actions
task release-create
```

## Tests

### Unit tests

Can be run without prior setup:

```sh
task test-unit
```

### Integration tests

Integration tests are manual for now:
- They require real Cloud accounts
- They create real Cloud resources which are billed and may persist in case of failure, requiring manual cleanup and knowing about underlying tools

**Do NOT run these integration tests if you're not sure about what you're doing to avoid being billed for Cloud resources.**

Integration tests using CLI

```
test/integ/cli-full-lifecycle/run.sh [aws|gcp|azure|paperspace]
```

Using Mocha

```
npx mocha test/integ/pulumi/preview.spec.ts
npx mocha test/integ/pulumi/up.spec.ts
npx mocha test/integ/paperspace/client.spec.ts
```

### Development

Development can be done under Nix development shell:

```sh
nix develop
```

#### Various dev tasks
Run app directly with `npx`:

```sh
npx tsx src/index.ts configure test-create-destroy-gcp
```

To debug Ansible playbook easily:

- Run `cloudypad` with verbose log to show Ansible inventory temporary file, eg:
```sh
npx tsx src/index.ts configure test-create-destroy-gcp -v 4
# ...
# 2024-11-07 10:06:53.036 DEBUG   /dist/src/tools/ansible.js:14   AnsibleClient   Ansible command: ansible-playbook ["-i","/tmp/cloudypad-KlRsDX/inventory.yml","/cloudypad/dist/ansible/playbook.yml"]
# ...
```

Then run Ansible directly:

```sh
ansible-playbook -i /tmp/nix-shell.fD63LM/cloudypad-BX2kYb/inventory.yml ansible/playbook.yml -t wolf --start-at-task="Copy docker-compose file"
```

Will eventually add an easier way to pass custom Ansible options such as `--ansible-additional-flag` option or environment variable. 

#### Development Virtual Machine

A local Virtual Machine can be created with Vagrant:

```sh
vagrant up
```

Machine IP is hardcoded in Vagrantfile to `192.168.56.43`.

Can be used to run Sunshine container and test Ansible playbook easily.

Fast Sunshine container build and import:

```sh
task dev-docker-sunshine-to-vm
```

Ansible test:

```sh
ansible-playbook -i ansible/inventories/dev-vagrant.yml ansible/sunshine.yml -t sunshine
```

Connect to Sunshine web UI (Sunshine is forwarded to local machine):

```sh
http://localhost:47990
```

### Local Pulumi stack manipulation

Nix development shell automatically set `PULUMI_BACKEND_URL` and `PULUMI_CONFIG_PASSPHRASE` environment variables, allowing to manipulate Pulumi stacks locally.

```sh
# List stacks
pulumi stack ls -a

# Show stack resources
pulumi stack -s <organization/CloudyPad-XXX/STACK> --show-ids

# Destroy stack
pulumi destroy -s <organization/CloudyPad-XXX/STACK>

```


## Maintenance

## Regular updates

- [ ] Node deps
- [ ] NVIDIA driver version `ansible/roles/nvidia-driver/defaults/main.yml` `nvidia_driver_dotrun_install_version`
- [ ] Wolf version (see below)
- [ ] Sunshine Dockerfile `containers/sunshine/Dockerfile`
  - [ ] Base image version `FROM`
  - [ ] Steam version `CLOUDYPAD_STEAM_VERSION`

### Updating Wolf version

Wolf is deployed via Docker Compose and templated config. To ensure reproducibility, Wolf version and apps images are pinned to a specific SHA.

To update Wolf:

- Update Wolf version in `ansible/roles/wolf/templates/docker-compose.nvidia.yml` (stable with SHA)
- Update images versions in `ansible/roles/wolf/defaults/main.yml` to use latest stable (master with SHA)
- Update Wolf config template in `ansible/roles/wolf/templates/wolf-config.toml` using default config
  - Generate default config by running a Wolf container (will generate default config on start) and copy it:
  ```
  docker run --name wolf-config ghcr.io/games-on-whales/wolf:stable # exit with CTRL+C
  docker cp wolf-config:/etc/wolf/cfg/config.toml .
  ```
  - Ensure proper Ansible templates variables are used

## Adding a new provider

This section outlines how to add a new provider. It's still scarce but provides a basic entrypoint to help implemented a new provider. 

Implementing a new provider requires to:

- Implement various components to manage instance lifecycle (Runner, Provisioner, Initializer...)
- Integrating these components into main code

### Provider components

Each component must implement a stricly defined interface, allowing seamless integration in Cloudy Pad core:

- [ ] Initializer - Prompt users for required options during creation. 
- [ ] Provisioner - Use Pulumi to deploy the instance.
  - Will require a Pulumi stack definition under `src/tools/pulumi`
- [ ] Runner - Start/stop/restart instance. 
- [ ] State - Describe configuration and current state (outputs) for the instance.
- [ ] Factory - Create Provisioner and Runner instances for global Instance Manager 

Along with clients, Pulumi stack, etc. as required.

See existing providers for example in `src/providers`.

### Integrate provider in Core

Integrate Provider in core:

- [ ] Add provider name and classes in `src/core/const.ts`
- [ ] Add provider registration in `src/core/manager-builder.ts`
- [ ] Add a `create` sub-command for provider in `src/cli/program.ts` with options matching provider state interface. 

### Tests

- [ ] Add unit test in `test/unit/<provider>`
- [ ] Add CLI full lifecycle tests in `test/integ/cli-full-lifecycle`
- [ ] Add Pulumi tests in `test/integ/pulumi`
- [ ] Add provider tests in `test/integ/<provider>`
## Adding new CLI args

To add a new global or commong CLI argument used by all or multiple providers:

- [ ] Add new `CLI_` option variable in `src/cli/command.ts`
- [ ] Ensure CLI option variable is used by all relevant providers in `src/providers`
- [ ] Ensure CLI option is handled by `cliArgsIntoPartialInput` 
- [ ] Update state Inputs if needed
- [ ] Update tests default values if needed