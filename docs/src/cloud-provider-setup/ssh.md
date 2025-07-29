# SSH - Deploy on your own server

Use SSH provider to transform your own machine or server into a Cloud gaming instance.

## SSH Provider is still experimental 🧪

SSH provider is freshly from the oven and may have some limitations or bugs. Please [Create an issue](https://github.com/PierreBeucher/cloudypad/issues) or [reach us on Discord](https://discord.gg/QATA3b9TTa) if you encounter problems.

## Pre-requisites

Server specs and requirements

- **Fresh installation** of Ubuntu 22 or Ubuntu 24
- Reachable via SSH (private key or password)
- Hardware: minimum 4 CPU - 8GB RAM
  - Smaller specs might work but performances won't be ideal
- GPU type: NVIDIA (both consumer-grade like RTX 4090 and professional-grade like L4 are supported)
- Make sure **no NVIDIA driver are already installed** or uninstall existing drivers beforehand as Cloudy Pad currently support specific set of NVIDIA versions and existing driver installation may conflict with expected ones. 
  - Trying to install Cloudy Pad on non-Ubuntu servers (like Debian) _may work_ but isn't officially supported yet
- Localhost installation is not supported yet (running Cloudy Pad installation from the same machine you are targetting) as your machine will reboot multiple times during installation process, in which case the installation process would be interrupted
  - Make sure to run deployment from another machine from the one you are targetting

## Using SSH provider

Make sure to have the SSH key or password on hand and run:

```sh
cloudypad create ssh
```