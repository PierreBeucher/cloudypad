# Root Disk Snapshot Feature Implementation

## Summary

Implementing root disk snapshotting for Scaleway and Linode. On initial deploy (after provision and configure), a snapshot of the root disk is created capturing the configured system (NVIDIA drivers, Cloudy Pad, etc.). This snapshot/image is used for subsequent instance starts.

## Issues

### Initial provision fails with "no image ID provided" even with rootDiskSnapshot enabled (fixed)

The check in `doMainProvision` was too strict - it required an image ID to already exist, but during initial deploy the root disk snapshot is created _after_ provision and configure. Fixed by also checking `rootDiskSnapshot.enable` - if enabled, the snapshot will be created at the end of deploy.

### Root disk ID is cleared before snapshot can be created (fixed)

In `deploy()`, calling `doStop()` triggers the full stop flow which sets `instanceServerState: absent` and deletes the server, also clearing the `rootDiskId` from provision output. But we need the `rootDiskId` to create the snapshot. Fixed by using `runner.stop()` directly instead of `doStop()` to just stop the instance without triggering server deletion.

### Block Snapshot cannot be used to boot a server - need Instance Image (fixed)

The root disk snapshot was creating a Scaleway **Block Snapshot** (`scw.block.Snapshot`), but the `Server` resource's `image` field expects an **Instance Image** (`scw.instance.Image`) which is a different resource type. Block Snapshots are for volume backup/restore, while Instance Images are bootable images for creating servers. 

Additionally, Instance Snapshots (`scw.instance.Snapshot`) only work with Instance local volumes (`l_ssd`), NOT with SBS Block Storage volumes (`sbs_volume`). Since our root volume uses SBS for better reliability, we can't use Instance Snapshots/Images.

**Final Solution**: Use Block Snapshots and boot from a volume created from the snapshot:
1. Create a Block Snapshot (`scw.block.Snapshot`) of the root SBS volume
2. On server recreation, create a Block Volume from the snapshot
3. Use that volume as the server's root volume via `rootVolume.volumeId`

This required updating:
- `root-snapshot.ts`: Create Block Snapshot (not Instance Snapshot)
- `main.ts`: Add `rootVolume.snapshotId` parameter; when provided, create Block Volume from snapshot and use as root volume
- `provisioner.ts`: Pass `rootDiskSnapshotId` to `rootDisk.snapshotId` config (not `imageId`)

## Testing Log

### Test 1: Full lifecycle test - Create, Stop x2, Start x2

Commands used:
```bash
CLOUDYPAD_SKIP_CONFIGURATION=true npx tsx src/cli/main.ts create scaleway \
  --name root-disk-snapshot-test \
  --project-id "02d02f86-9414-4161-b807-efb2bd22d266" \
  --region fr-par --zone fr-par-2 --instance-type L4-1-24G \
  --root-disk-size 30 --data-disk-size 100 \
  --streaming-server sunshine --sunshine-user sunshine --sunshine-password 'sunshine!' \
  --autostop true --autostop-timeout 300 \
  --yes --overwrite-existing --skip-pairing \
  --data-disk-snapshot-enable \
  --root-disk-snapshot-enable \
  --delete-instance-server-on-stop

CLOUDYPAD_SKIP_CONFIGURATION=true npx tsx src/cli/main.ts stop root-disk-snapshot-test --wait
CLOUDYPAD_SKIP_CONFIGURATION=true npx tsx src/cli/main.ts stop root-disk-snapshot-test --wait
CLOUDYPAD_SKIP_CONFIGURATION=true npx tsx src/cli/main.ts start root-disk-snapshot-test
CLOUDYPAD_SKIP_CONFIGURATION=true npx tsx src/cli/main.ts start root-disk-snapshot-test
```

Results:
1. **Create** - ✅ Created instance, created root disk Block Snapshot at end of deploy
2. **Stop #1** - ✅ Created data disk snapshot, deleted server and data disk  
3. **Stop #2** - ✅ No-op (already stopped)
4. **Start #1** - ✅ Created root volume from snapshot, created data disk from snapshot, created server
5. **Start #2** - ✅ No-op (already running)


