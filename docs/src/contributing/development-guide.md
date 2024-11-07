# Development guide

- [Release](#release)
- [Tests](#tests)
  - [Unit tests](#unit-tests)
  - [Integration tests](#integration-tests)
  - [Development](#development)
  - [Scripts](#scripts)
- [Adding a new provider](#adding-a-new-provider)

## Release

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
test/integ/create-and-destroy.sh
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

### Scripts

## Adding a new provider

This section outlines how to add a new provider. It's still scarce but provides a basic entrypoint to help implemented a new provider. 

Implement all provider objects:

- [ ] Initializer
- [ ] Provisioner
- [ ] Runner
- [ ] State

Along with clients and others as required.

Add new provider to Manager:

- [ ] `CLOUDYPAD_PROVIDER_XXX` in `src/core/const.ts`
- [ ] `promptInstanceInitializer` prompt
- [ ] `getCurrentProviderName`
- [ ] `getInstanceRunner`
- [ ] `getInstanceProvisioner`

Finalize:
- [ ] Add `create PROVIDER` command in `src/index.ts`
- [ ] Add proper bind mounts and environment variables in `cloudypad.sh`
- [ ] Add test case in `test/integ/created-and-destroy.sh`