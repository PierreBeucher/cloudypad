# Cloudy Pad Roadmap

Next big features and improvements

## Cloudy Pad platform

Cloudy Pad plaform will provide a way to deploy and managed your instances using a non-technical user friendly platform. Head to [Cloudy Pad Platform](https://app.cloudypad.gg) to try out the beta version !

## Cost reduction: OS Disk snapshot

On stopping your instance, a disk snapshot will be made instead of keeping disk as-is. On next usage, instance will be restored from snapshot.

As snapshot are generally cheaper than disks it will provide a great cost reduction.

## Cost reduction: Data move to S3 on stop (or cheap Cloud storage)

On instance stop, instead of keeping data disk (and being billed for it), your data will be moved to an S3 bucket (or equivalent storage) which is much cheaper. On next usage S3 data will be moved back to data disk.

As S3 is much cheaper than disks, this will provide subsequent cost reduction on data disk.