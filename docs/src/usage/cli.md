# `cloudypad` CLI usage

_🧪 `cloudypad` CLI interface is still experimental and may change in the future_

- [Create instances](#create-instances)
- [Manage instances](#manage-instances)
- [Instance deployment lifecycle](#instance-deployment-lifecycle)
- [Environment variables](#environment-variables)
  - [Cloudy Pad built-in environment variables](#cloudy-pad-built-in-environment-variables)
  - [Other environment variables](#other-environment-variables)
- [Global configuration](#global-configuration)

Available commands:

```sh
$ cloudypad --help

Usage: cloudypad [options] [command]

Cloudy Pad CLI to manage your own gaming instance in the Cloud.

Options:
  --verbose, -v               Verbosity level (0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal)
                              Alternatively, use CLOUDYPAD_LOG_LEVEL environment variable.
  -V, --version               output the version number
  -h, --help                  display help for command

Commands:
  create                      Create a new instance, prompting for details. Use `create <provider> for provider-specific creation commands.`
  list [options]              List all instances
  start <name>                Start an instance
  stop <name>                 Stop an instance
  restart <name>              Restart an instance
  get <name>                  Get details of an instance
  provision [options] <name>  Provision an instance (deploy or update Cloud resources)
  configure <name>            Configure an instance (connect to instance and install drivers, packages, etc.)
  destroy <name>              Destroy an instance
  pair <name>                 Pair an instance with Moonlight
  help [command]              display help for command
```

## Create instances

Use `cloudypad create`. It will prompt for required parameters depending on your Cloud Provider.

```sh
cloudypad create 

# Or for a specific provider
cloudy pad create azure
cloudy pad create aws
cloudy pad create gcp # Google
cloudy pad create paperspace
```

You can also specify all arguments as flags for non-interactive creation, for example:

```sh
cloudypad create aws \
  --name $instance_name \
  --private-ssh-key ~/.ssh/id_ed25519 \
  --instance-type g4dn.xlarge \
  --disk-size 100 \
  --public-ip-type static \
  --region eu-central-1 \
  --spot \
  --yes --overwrite-existing
```

Use `cloudypad create <provider> --help` for available flags.

Alternatively, see [CLI integration tests](https://github.com/PierreBeucher/cloudypad/blob/master/test/integ/cli-full-lifecycle) for available flags

## Manage instances

List existing instances:

```sh
cloudypad list
```

Get instance details:

```sh
cloudypad get mypad
```

Start/stop/restart instance:

```sh
cloudypad start mypad
cloudypad stop mypad
cloudypad restart mypad
```

By default instance stop/start/restart triggers the action without waiting. Wait for action to finish with `--wait` (and optionally `timeout <seconds>`)

```sh
cloudypad [start|top|restart] mypad --wait --timeout 180
```

Destroy instance:

```sh
cloudypad destroy mypad
```

## Instance deployment lifecycle

When you `create` your instance, creation process goes through various steps:

- Provisioning: create all Cloud resources for your instance (virtual machine, IP address, virtual disk...)
- Configuration: install required packages and softwares on your instance (eg. Wolf server)
- Pairing: pair your instance with Moonlight

These actions can be performed directly via commands below.

Provision an instance to create/update Cloud resources for your instance.

```sh
cloudypad provision mypad
```

Run instance configuration:

```sh
cloudypad configure mypad
```

Pair Moonlight with an existing instance:

```sh
cloudypad pair mypad
```

## Environment variables

### Cloudy Pad built-in environment variables

Environment variables used by Cloudy Pad and example values

```sh
# Log level. Also exposed via CLI --verbose flag.
# 0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal
CLOUDYPAD_LOG_LEVEL=3

# Set -x bash flag to show all commands executed by launcher script
CLOUDYPAD_CLI_LAUNCHER_DEBUG=1

# Home directory for Cloudy Pad data
CLOUDYPAD_HOME=~/.cloudypad

# Cloudy Pad version to use for launcher.
# Beware: changing this value will change Cloudy Pad container image used
# which may not be compatible with launch version installed
CLOUDYPAD_VERSION=0.7.0

# Override Cloudy Pad container image used by launcher
CLOUDYPAD_IMAGE="crafteo/cloudypad:$CLOUDYPAD_VERSION"
```

### Other environment variables

Cloudy Pad relies on external tools and libraries like AWS library and Ansible to manage your instances. Some variables can set to alter behavior.

See [`env_vars` variable in launcher script](https://github.com/PierreBeucher/cloudypad/blob/master/cloudypad.sh#L117C11-L117C19) for details. 

## Global configuration

A global configuration is saved under `$HOME/.cloudypad/config.yml`. Later version will add commands to manipulate this configuration.