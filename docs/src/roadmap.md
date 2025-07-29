# Cloudy Pad Roadmap

Next big features and improvements

## Cloudy Pad App - Done 07-2025

Cloudy Pad App will provide a way to deploy and manage gaming instances using a non-technical user friendly platform. 

Start playing now on [Cloudy Pad App](https://app.cloudypad.gg) !

## Cost reduction: OS Disk snapshot

On stopping your instance, a disk snapshot will be made instead of keeping disk as-is. On next usage, instance will be restored from snapshot.

As snapshots are generally cheaper than disks it will provide a great cost reduction.

## Cost reduction: Data move to S3 on stop (or cheap Cloud storage)

On instance stop, instead of keeping data disk (and being billed for it), your data will be moved to an S3 bucket (or equivalent storage) which is much cheaper. On next usage S3 data will be moved back to data disk.

## Additional game launchers on Sunshine: Lutris, Epic, Heroic and more

Only Steam is supported on Sunshine for now. Cloudy Pad will soon support additional game launchers like Lutris, Epic, Heroic and more !