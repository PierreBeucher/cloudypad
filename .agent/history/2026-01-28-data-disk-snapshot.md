# Data Disk Snapshot Feature Implementation

## Summary

Successfully implemented data disk snapshotting for Scaleway to reduce costs. On stop, data volume is snapshot then deleted. On start, data volume is restored from snapshot.

## Major Changes

### Initial Implementation

- Added `--data-disk-snapshot-enable` CLI flag to Scaleway create command to enable the feature
- Added `dataDiskSnapshotId` field to CommonProvisionOutput schema for tracking snapshot IDs
- Created dedicated `ScalewayDataDiskSnapshotPulumiClient` Pulumi stack to manage snapshot creation separately from main infrastructure
- Modified Scaleway main Pulumi stack to support `dataDiskSnapshotId` (restore from snapshot) and `noDataDisk` (delete volume) options

### Refactoring: State-based provisioner control

Refactored the manager/provisioner interface to use state-based inputs instead of dedicated methods:

- Changed `dataDiskSnapshotEnable: boolean` to `dataDiskSnapshot: { enable: boolean }` for extensibility
- Added `runtime` object to CommonProvisionInputV1Schema to clearly separate user config from runtime state:
  - `runtime.enableInstanceServer?: boolean` - if true, server should exist; if false, delete server
  - `runtime.dataDiskState?: "live" | "snapshot"` - "live" = disk should exist, "snapshot" = create snapshot then delete disk
- Removed dedicated methods from InstanceProvisioner interface (`destroyInstanceServer()`, `createDataDiskSnapshot()`, `destroyDataDiskSnapshot()`)
- Manager now updates `runtime` state before calling `provision()`:
  - On stop: sets `enableInstanceServer: false` (if deleteServerOnStop), `dataDiskState: "snapshot"` (if snapshot enabled)
  - On start: sets `enableInstanceServer: true`, `dataDiskState: "live"`
- Provisioner reads runtime state from input and acts accordingly (no conditional logic in manager)
- Updated Scaleway and Dummy provisioners to handle runtime state in `doProvision()`

### Refactoring: Split provisioner into dataSnapshotProvision and mainProvision

Split the provisioner responsibilities more clearly between manager and provisioner:

- **InstanceProvisioner interface** now has two methods:
  - `dataSnapshotProvision()` - manages snapshot stack based on `runtime.dataDiskState`
  - `mainProvision()` - manages main infrastructure (server, disks) based on runtime flags
- **Manager `doProvision()`** now calls both methods in sequence:
  1. First calls `dataSnapshotProvision()` - updates snapshot state
  2. Rebuilds provisioner with updated state (includes snapshot output)
  3. Calls `mainProvision()` - handles server/disk operations
- **Scaleway provisioner** implements split:
  - `doDataSnapshotProvision()`: creates snapshot if `dataDiskState=snapshot`, else returns current state
  - `doMainProvision()`: runs main Pulumi stack, destroys snapshot stack after disk restoration
- **Other providers** (AWS, Azure, GCP, Paperspace, Linode, SSH, Dummy) implement no-op for `doDataSnapshotProvision()`, return current output
- **Added `CLOUDYPAD_SKIP_CONFIGURATION=true`** env var support in manager to skip Ansible configuration during testing

## Issues

### Snapshot creation also deleted instance server (fixed)

When creating snapshot on stop, the provisioner was setting `noInstanceServer: true` which deleted the server even when `deleteInstanceServerOnStop` was not enabled. Fixed by only setting `noDataDisk: true` - server deletion is handled separately.

### Start didn't restore data disk from snapshot (fixed)

When `dataDiskSnapshot.enable` was true but `deleteInstanceServerOnStop` was false, the start flow didn't trigger provision to restore the data disk from snapshot. Fixed by adding a check in `start()` to call `doProvision()` when `dataDiskSnapshot.enable` is enabled.

### Snapshot update failed on second stop (fixed)

On second stop, the snapshot Pulumi stack already existed and Pulumi tried to UPDATE the snapshot with a new volumeId. The Scaleway provider has issues with this update (`scaleway-sdk-go: invalid argument(s): name,tags is required`). Fixed by destroying the snapshot stack after restoring from it during `start` provision - this ensures each stop creates a fresh snapshot rather than trying to update an existing one.

### Constants for data disk state values

Added `DATA_DISK_STATE_LIVE` and `DATA_DISK_STATE_SNAPSHOT` constants to `src/core/const.ts` to avoid magic strings in comparisons across manager and provisioner code.
