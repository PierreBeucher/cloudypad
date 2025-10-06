# Upgrade guide

On upgrade Cloudy Pad will ensure retrocompatibility as best as possible. However some features may remain disabled if you're upgrading from an older version to avoid breaking changes or data loss.

Only changes requiring manual intervention are listed here. If not, upgrade process is transparent.

## 0.24.0 - Scaleway volume deprecation and data disk

This version introduces several changes for Scaleway

### Scaleway legacy volume deprecation

Scaleway is deprecating `b_ssd` volumes support and you won't be able to `cloudypad provision` existing Scaleway instances unless you upgrade your instance's volume following [Scaleway migration guide (Internet Archive link since original link is not available anymore)](https://web.archive.org/web/20250805052923/https://www.scaleway.com/en/docs/instances/how-to/migrate-volumes-snapshots-to-sbs/#migrating-using-the-instance-apicli-migration-endpoint-plan-and-apply).

Alternatively:
- Use `cloudypad configure` instead of `cloudypad provision` or `cloudypad update` - Note that it will not fully update your instance since provision will be skipped, but it should work nonetheless
- Create a new instance (but you'll need to reinstall your games)

### Dedicated data disk for Scaleway instances

Dedicated data disk is a feature splitting OS (system) disk and data disk to improve maintenability and help with cost reduction (to avoid paying for OS disk while instance is stopped in later releases).

Older instances won't enable dedicated data disk by default to keep retrocompatibility. To enable Scaleway dedicated Data disk:

- Migrate legacy root volume to new volume type (see above)
- Perform upgrade and update with `cloudypad configure` - choose a 0 GB data disk size for now
- SSH into your instance and move (not copy) folder `mv /var/lib/cloudypad/data /var/lib/cloudypad/data-backup`
- Run `cloudypad update scaleway --name my-instance --data-disk-size <size-gb>` with your desired data disk size
    - This will create a new data disk and mount it in your instance at `/var/lib/cloudypad/data`
- SSH into your instance and move back data folder `mv /var/lib/cloudypad/data-backup /var/lib/cloudypad/data`

You're all done ! Your instance is now using a dedicated data disk.