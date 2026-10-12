---
name: infra-feedback-loop
description: Efficient feedback loop and problem fix when working with Instance deployment and infrastructure using real Cloud resources or the local Vagrant dev VM. Use when testing Instance deployment (creation, deployment, provision, configuration, start/stop, destroy, etc.)
---

# Debug workflow: local and Cloud

- [General instructions](#general-instructions)
  - [Include contribution doc](#include-contribution-doc)
  - [Debug instructions](#debug-instructions)
- [Full instance lifecycle](#full-instance-lifecycle)
  - [Instance Provision](#instance-provision)
  - [Instance Configuration](#instance-configuration)
  - [Instance Start](#instance-start)
  - [Instance Stop](#instance-stop)
  - [Instance Destroy](#instance-destroy)
- [Commands and environment variables](#commands-and-environment-variables)
  - [Create and deploy instance for debugging](#create-and-deploy-instance-for-debugging)
    - [AWS](#aws)
    - [Azure](#azure)
    - [GCP](#gcp)
    - [Scaleway](#scaleway)
  - [Provision](#provision)
  - [Configure, create or deploy with specific Ansible tasks target](#configure-create-or-deploy-with-specific-ansible-tasks-target)
  - [Start and Stop](#start-and-stop)
  - [Destroy](#destroy)
  - [Pulumi commands](#pulumi-commands)
  - [Environment variables](#environment-variables)
  - [SSH into instance](#ssh-into-instance)
  - [Running and using integration tests](#running-and-using-integration-tests)
- [Local debug with Vagrant VM](#local-debug-with-vagrant-vm)
  - [Initial dev workflow setup](#initial-dev-workflow-setup)
  - [Container overlay update](#container-overlay-update-in-containerssunshineoverlay)
  - [Dockerfile/Containerfile and package update](#dockerfilecontainerfile-and-package-update)
  - [Ansible playbook update](#ansible-playbook-update)
  - [Observe and debug the container in VM](#observe-and-debug-the-container-in-vm)
  - [Local debug footguns](#local-debug-footguns)
- [Infrastructure provisioning and Pulumi deployment](#infrastructure-provisioning-and-pulumi-deployment)
- [Useful references](#useful-references)

Debugging Cloudy Pad instance deployment might be complex as it includes building container image, provisioning and configure VM, running Ansible, running containers and debugging lots of processes in Cloudy Pad container (supervisord, Sunshine, desktop environment...). This skill describe how to debug efficiently and with a fast feedback loop.

## General instructions

### Include contribution doc

Always read content of `docs/src/contributing/contribution-guide.md`, it contains useful commands and debug instructions

### Debug instructions

Workflow:

- Identify the failure reason and related component. Identify clearly if it's related to Pulumi, Ansible, a Cloud client we implemented or something else. 
- You are allowed to run CLI commands (`az`, `aws`, `gcloud`, `pulumi`, `vagrant`...) to read and delete resources related to our instance.
- Update code to try and fix issue
- Don't run entire test suites and deployment script every retry, instead run only specific commands or test that will try again or fix the specific the part that failed before continuing
- When problem is fixed, you can the overall test and command again to see entire flow still works

## Full instance lifecycle

Instance Deployment (or Update) is a full cycle of state creation/update, provision, configuration, stop, base image creation and start again. It's quite long. Depending on where we had failure:

- Before provision: you can start test again from the beginning since we were at the beginning
- During Provision, typically a Pulumi issue: don't run full deployment again, see Provision workflow
- During Configuration, typically an Ansible issue: don't run full deployment again. May be related to several problems:
  - Root cause is Ansible-specific issue (eg. a malformed task, or a missing package on machine): fix Ansible and run Configuration targetting impacted tasks
  - Root cause is infrastructure (eg. a missing Cloud resource): fix, run Provision and Configuration again, run Configuration targetting impacted tasks
  - Root cause is unclear (not Ansible itself, unrelated to infrastructure or code): first try to run Configuration targetting impacted tasks, then try to Provision + Configuration, and as last resort re-run full Deployment
- During instance Stop before base image creation: fix and try to Stop instance again
- During instance Base image creation: fix and run Instance Base Image update again 
- During instance Start after Base image creation: fix and run Instance Start again, if it fails, try to identify the best place to continue our test

See below for specifics on each steps.

### Instance Provision

Typically a Pulumi or internal code issue: fix and run Provision again.

### Instance Configuration

Typically an Ansible issue. Don't run entire configuration and Ansible playbook again. May be related to several problems:
- Root cause is Ansible-specific issue (eg. a malformed task, or a missing package on machine): fix then run Configuration targetting impacted Ansible tasks
- Root cause is infrastructure (eg. a missing Cloud resource): fix, run Provision to update infra and then run Configuration targetting impacted Ansible tasks
- Root cause is unclear (not Ansible itself, unrelated to infrastructure or code): try to fix, run Configuration targetting impacted tasks. If it doesn't work, you can run Provision then Configuration again.
        
### Instance Start

Start is actually comprised of Data disk snapshot restoration, Provision and Start. 

- Issue with Data disk Snapshot Restoration: maybe coming from how Data disk is passed to Main Pulumi stack or an issue with Snapshot creation.
  - If issue is how Data Disk snapshot is created: fix and run Stop again to provision disk again, and Start again
  - If issue is how Provision and Main Pulumi works with given snapshot: just fix and Start again
  - If issue is after Provision: fix and Start again
- Other issue: fix and Start again

### Instance Stop

Stop will actually stop the Instance Server, create Data Disk Snapshot then run Provision with desired Instance Server to deleted state (so as to keep only data snapshot)

- Issue with Instance Server stop: fix and run Stop again
- Issue with Data Disk Snapshot creation:
  - If a simple timeout (as it may be long): increase timeout and Stop again
  - If a more complex issue: in most situations, fixing related code and running Stop is OK. But you may need to run Provision or another task as well.
- Issue with Provision for resources deletion: Fix and stop again. At this point Data Disk Snapshot should be created and Stop will be fast.

### Instance Destroy

Try deletion again. If needed, try to delete manually, ONLY if you're sure that deleted resources are directly related to our instance. Otherwise stop and ask for input. 

## Commands and environment variables

### Create and deploy instance for debugging

Use debug CLI to create an instance without interaction. All CLI flags must be passed so as not to be prompted:

#### AWS

```sh
# Set name according to current test
instance_name=test-instance-aws

# Prefer these default parameters
# Override accordingly for test being done
npx tsx src/cli/main.ts create aws \
  --name $instance_name \
  --instance-type g4dn.xlarge \
  --disk-size 30 \
  --data-disk-size 10 \
  --region eu-central-1 \
  --zone eu-central-1a \
  --spot disable \
  --cost-alert \
  --cost-limit 2 \
  --cost-notification-email "test@cloudypad.gg" \
  --streaming-server sunshine \
  --sunshine-user sunshine \
  --sunshine-password 'S3un$h1ne!"' \
  --autostop true \
  --autostop-timeout 300 \
  --data-disk-snapshot \
  --base-image-snapshot \
  --delete-instance-server-on-stop \
  --yes --overwrite-existing --skip-pairing
```

#### Azure

```sh
# Set name according to current test
instance_name=test-instance-az

# Prefer these default parameters
# Override accordingly for test being done
npx tsx src/cli/main.ts create azure \
  --name $instance_name \
  --vm-size Standard_NC8as_T4_v3 \
  --disk-size 100 \
  --data-disk-size 10 \
  --disk-type Standard_LRS \
  --location "francecentral" \
  --spot disable \
  --subscription-id 0dceb5ed-9096-4db7-b430-2609e7cc6a15 \
  --cost-limit 2 \
  --cost-notification-email "test@cloudypad.gg" \
  --streaming-server sunshine \
  --sunshine-user sunshine \
  --sunshine-password 'S3un$h1ne!"' \
  --autostop true \
  --autostop-timeout 300 \
  --data-disk-snapshot \
  --base-image-snapshot \
  --delete-instance-server-on-stop \
  --yes --overwrite-existing --skip-pairing
```

#### GCP

```sh
# Set name according to current test
instance_name=test-instance-gcp

# Prefer these default parameters
# Override accordingly for test being done
npx tsx src/cli/main.ts create gcp \
  --name $instance_name \
  --machine-type n1-standard-8 \
  --disk-size 100 \
  --data-disk-size 10 \
  --disk-type pd-standard \
  --network-tier STANDARD \
  --nic-type auto \
  --region "europe-west4" \
  --zone "europe-west4-b" \
  --gpu-type "nvidia-tesla-t4" \
  --project-id crafteo-sandbox \
  --spot disable \
  --cost-limit 2 \
  --cost-notification-email "test@cloudypad.gg" \
  --streaming-server sunshine \
  --sunshine-user sunshine \
  --sunshine-password 'S3un$h1ne!"' \
  --autostop true \
  --autostop-timeout 300 \
  --data-disk-snapshot \
  --base-image-snapshot \
  --delete-instance-server-on-stop \
  --yes --overwrite-existing --skip-pairing
```

#### Scaleway

```sh
# Set name according to current test
instance_name=test-instance-scw

# Prefer these default parameters
# Override accordingly for test being done
npx tsx src/cli/main.ts create scaleway \
  --name $instance_name \
  --project-id "02d02f86-9414-4161-b807-efb2bd22d266" \
  --region fr-par \
  --zone fr-par-2 \
  --instance-type L4-1-24G \
  --root-disk-size 30 \
  --data-disk-size 10 \
  --streaming-server sunshine \
  --sunshine-user sunshine \
  --sunshine-password "sunshine!" \
  --autostop true \
  --autostop-timeout 300 \
  --data-disk-snapshot \
  --base-image-snapshot \
  --delete-instance-server-on-stop \
  --yes --overwrite-existing --skip-pairing
```

### Provision

```sh
npx tsx src/cli/main.ts provision my-instance
```

### Configure, create or deploy with specific Ansible tasks target

```sh
# Run Configuration with specifc tasks target or roles
# You can use Ansible flags like "-t data-disk" or "--start-at-task xxx" 
# to run specific configuration steps for faster feedback loop
npx tsx src/cli/main.ts configure my-instance --ansible-args-override "-t data-disk"

# Also works for deploy, create and start command
npx tsx src/cli/main.ts create [...lots of args...] --ansible-args-override "-t data-disk"
npx tsx src/cli/main.ts deploy my-instance --ansible-args-override "-t data-disk"
npx tsx src/cli/main.ts start my-instance --ansible-args-override "-t data-disk"
```

### Start and Stop

```sh
npx tsx src/cli/main.ts start my-instance --wait
npx tsx src/cli/main.ts stop my-instance --wait
```

### Destroy

```sh
npx tsx src/cli/main.ts destroy --yes my-instance
```

### Pulumi commands

Specific pulumi commands you can run when needed:

- If stack is stuck as another update is or was already in progress (typically Pulumi was interrupted)
- If direct stack operation is needed (eg. cleanup, cancel, destroy, etc.)

```sh
# Show all stacks
pulumi stack ls -a

# Cancel a stack (example with Azure stack)
pulumi cancel -y -s organization/CloudyPad-Azure/test-azure-advanced

# Force destroy with refresh of a stack 
pulumi destroy -ryf -s organization/CloudyPad-Azure/test-azure-advanced
```

### Environment variables

```sh
# Enable DEBUG log level (if not already done)
export CLOUDYPAD_LOG_LEVEL=2

# Skip Ansible configuration altogether
# Useful for quick feedback loop on infra-specific aspects
export CLOUDYPAD_SKIP_CONFIGURATION=true

# Override Ansible args to run specific tasks or tags
# Allowing faster feedback when running configuration
export CLOUDYPAD_ANSIBLE_ARGS_OVERRIDE="-t data-disk"
```

### SSH into instance

See docs: `docs/src/usage/ssh.md`

### Running and using integration tests

Tests under `test/integ/stable/core/providers/<provider>/lifecycle[.*].ts` are useful for feedback to create instances and do various lifecycle checks. When using these tests:

- Comment/uncomment some part of the test depending on context.
  - For example, when testing an infrastructure side aspect, it may be useful to disable anything related to Ansible with `CLOUDYPAD_SKIP_CONFIGURATION=true`
- When it fails, do NOT RUN EVERYTHING AGAIN. Comment tests that are passing and ONLY RUN THE PART WE NEED.

## Local debug with Vagrant VM

A locally running Vagrant VM is available to debug locally. It does not have an available GPU, it relies on Sunshine software encoder and might behave differently than Cloud GPU, but should be enough to have a working container and working desktop environment with Sunshine - though it may be slower than GPU machine.

### Initial dev workflow setup

By default, for initial iteration (once per local machine boot), you need Vagrant VM and initial deployment:

```sh
# One-time action: deploy the VM
vagrant up

# Run FULL Ansible playbook: installs Docker (geerlingguy.docker role) and prepares the machine.
# MANDATORY on first provisioning: dev-docker-sunshine-to-vm only runs the "sunshine-docker"
# tagged tasks and does NOT install Docker - it would fail at the compose step.
task dev-ansible-config

# Copy local container image in VM (build + save + load + tagged deploy + force-recreate)
task dev-docker-sunshine-to-vm
```

It will re-build the container image, upload to Vagrant and force-recreate the container. 

However for minor tweaks after this - like updating a file in overlay or changing a simple Ansible config - this is too long. Use a more specific workflow as outlined below.

### Container overlay update in `containers/sunshine/overlay` 

Updates in `containers/sunshine/overlay` only require a container restart in VM. No need for full rebuild or Ansible run: we optimized this by mounting overlay in VM and directly in container, so a container restart is enough. Boot scripts (envsubst templates etc.) re-render configs at container start, so the restart picks up overlay changes.

```sh
vagrant ssh
$ docker restart cloudy
```

### Dockerfile/Containerfile and package update

A Dockerfile/Containerfile update needs a container rebuild and copy into the VM. Only a rebuild and copy into machine is needed, no need for full Ansible rerun (image content only). Use:

```sh
task dev-docker-sunshine-to-vm
```

### Ansible playbook update

Updating Ansible playbook or Ansible files/templates need an Ansible playbook run:

```sh
task dev-ansible-config
```

For faster feedback loop, run a specific Ansible config with only required `--tags` or directly `--start-at-task`

All-in-one (build + deploy image + ansible + restart) also exists: `task dev-ansible-config-with-docker`

### Observe and debug the container in VM

```sh
vagrant ssh
$ docker exec -u root cloudy supervisorctl status   # services state (sunshine, labwc, waybar, pipewire...)
$ docker logs -f cloudy                              # container logs
$ tail -f /cloudy/log/sunshine.log                   # Sunshine log (also labwc*.log in /cloudy/log)
$ docker exec -it cloudy bash                        # shell in container
```

### Local debug footguns

- **NEVER update the container files directly**. Do not chmod, install package, etc. directly in container - otherwise changes might be lost on next reboot or recreate, which will cause confusion. ALWAYS update the source or truth: scripts, Dockerfile or whatever, which will eventually be applied in container.
- **Config wipe on restart**: start scripts re-render configs (envsubst) at container start. Manual edits inside `/cloudy/conf/sunshine/sunshine.conf` are LOST on `docker restart`. Change the template or inventory var instead.
- **Stale persistent state**: `/cloudy/data` bind mount survives reboots and container recreation. When debugging pairing: `rm /cloudy/data/sunshine/sunshine_state.json` AND forget the host on the Moonlight client side, then pair fresh.
- **Vagrant SSH state desync**: multiple VirtualBox VMs exist (main repo + worktrees, `.vagrant/` lives at the root of the checkout that ran `vagrant up`). If `vagrant ssh` says "VM must be running" while `VBoxManage showvminfo <vm> --machinereadable | grep VMState=` says running, you're in the wrong checkout. Always run `vagrant`/`task dev-*` from the checkout the VM was created in.

## Infrastructure provisioning and Pulumi deployment

TBD

## Useful references

See for examples:

- Integration testing doing a full lifecycle with JS test and sane options: `test/integ/stable/core/providers/<provider>/lifecycle[.*].ts`. Use it to get more context about expected arguments during create and various steps. 
- For create CLI flags, see `test/integ/unstable/cli-full-lifecycle/<PROVIDER>.sh`. Use these create commands as example to avoid being prompted input with CLI. 
