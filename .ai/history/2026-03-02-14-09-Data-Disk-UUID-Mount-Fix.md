# Data Disk UUID Mount Fix

Fix data disk mounting to use UUID instead of device path for persistent mounting across reboots.

## Initial iteration

> let's try this work, you will start and stop instance and check it works:
- Start our AWS instance with cloudypad start (or related debug command)
- Run configuration with only data-disk role (to check fast feedback loop)
- Restart instance and check via SSH that our disk is properly mounted
  - First to a restart with cloudy pad restart and check
  - Fix accordingly and try configure/restart again
  - Then use cloudypad stop (will take a long time) and cloudypad start and check again
- when disk is mounted appropriateklt you can stop

### Code changes

Updated `ansible/roles/data-disk/tasks/main.yml` to use filesystem UUID instead of device path in fstab. Added tasks to retrieve UUID after formatting and use it in mount configuration.

### Issues encountered

**CLI option name**: Initially used `--ansible-additional-args` but the correct option is `--ansible-args-override` for the configure command. Fixed by checking the CLI program code.

**SSH connection timing**: After restart, the instance needs time to become SSH-ready. Added appropriate wait times and retry logic when connecting.

**Test results**: 
- After restart: Disk mounted correctly using UUID (`UUID=0ecc5b0b-aa44-4721-8d08-823db838cee7`), device name changed from `nvme0n1` to `nvme1n1` but mount persisted correctly
- After full stop/start cycle: Disk mounted correctly, UUID-based mount working as expected

The fix successfully resolves the issue where device paths change after reboot, ensuring persistent mounting across all reboot scenarios.

