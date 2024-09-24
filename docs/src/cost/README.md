# How much will I pay ? 🫰

Cloudy-Pad is free and open-source; however, charges may apply when using a Cloud provider. Typically billed resources:
- Machine usage (GPU, CPU, RAM)
- Disk storage
- IP address reservation

## Cost estimation

Estimations for a setup with **8 CPUs, ~30GB RAM, 100GB Disk for 30 hours / month**:

- Google Cloud: **~$15.68** (n1-standard-8 with NVIDIA T4000)
- AWS: **~$15.67** (g4dn.2xlarge with NVIDIA T4000)
- Azure: **~$11.06** (NC8as T4 v3 with NVIDIA T4000)
- Paperspace: **~$22.30** (NVIDIA P4000, a bit more powerful than T4000)

See per cloud providers estimations:

- [AWS](aws.md)
- [Azure](azure.md)
- [Google Cloud](gcp.md)
- [Paperspace](paperspace.md)

## Cost optimization

Some general recommandations to avoid unnecessary costs

## Spot instances

**💸 It's recommenced to use Spot instances as they are 30% to 90% cheaper !** As Spot instances interrupton is generally low, you probably won't get interruped during your session. However, make sure to save often nonetheless 😉

Spot instances are supported for Cloud providers:
- AWS
- Azure
- Google Cloud

Paperspace doesn't support Spot instances.

Spot instance usage is specified during instance creation with `cloudypad create` - you'llbe prompted for Spot instance usage, or you can use flag `cloudypad create <provider> --spot` for providers supporting Spot instances.

To have a better understand about spot instances, [see this article](https://www.cloudzero.com/blog/on-demand-vs-spot-instances/).

## Instance setup and specs recommandations 

- Choose a location or region as close as possible to you to avoid too much latency (eg. if you live in the US don't create your instance in Europe)
- Just provision what you need for: don't create a 500 GB disk if you intend to play a game that will only use 100 GB. 
- GPU / machine type depends on the game you play. Some game will run fine with 4 CPUs but needs high amount of memory such as 32 GB and more, while other will run fine with 4 GB memory but require lots of CPU or a stronger GPU. Refer to requirements and recommended settings for your game.

## Turn off your instance while not in use

That goes without saying, remember to turn off your instance while you're not using it to avoid unnecessary costs:

```sh
cloudypad stop mypad
```