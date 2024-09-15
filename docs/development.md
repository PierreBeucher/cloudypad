# Development guide

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