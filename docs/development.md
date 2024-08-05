# Development guide

## Release

Set `export GITHUB_TOKEN=xxx` variable and run:

```sh
# Create release branch
git checkout -b release-xxx

# Update version in all required files
task release-update-version

# Commit + push changes 
# TODO automate this step
git add package.json cloudypad.sh install.sh flake.nix
git commit -m "chore: prepare release XXX"
git push

# Create release PR for release-xxx branch
task release-pr

# Review and merge release PR
# TODO automate this step
...

# Create release container image
task release-build-image

# Create release with tag
task release-tag
```

## Tests

### Unit tests

Can be run without prior setup:

```sh
task test-unit
```

### Integration tests

Most integ tests are manual for now as they require Cloud accounts may create Cloud resource which would persist in case of failure.

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