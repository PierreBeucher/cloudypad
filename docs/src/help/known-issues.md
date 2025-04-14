# Known issues

- [Apple / MacOS](#apple--macos)
  - [Docker for MacOS and VirtioFS](#docker-for-macos-and-virtiofs)
- [Scaleway](#scaleway)
  - [Legacy `b_ssd` volumes support](#legacy-b_ssd-volumes-support)

## Apple / MacOS

### Docker for MacOS and VirtioFS 

For MacOS, if your Docker installation use VirtioFS, Cloudy Pad may fail with a Docker-related error such as: 

```
Error response from daemon: error while creating mount source path '/private/tmp/com.apple.launchd.ABCDEF/Listeners': mkdir /private/tmp/com.apple.launchd.ABCDEF/Listeners: operation not supported
```

This is a bug when using Docker for Mac VirtioFS file sharing with SSH agent. The bug is still being worked on, as a workaround you can either:

- Disable SSH agent before running Cloudy Pad, eg. `unset SSH_AUTH_SOCK`
- Switch Docker for Mac config to non-VirtioFS (eg. gRPC FUSE): go to _config > Resources > File Sharing_ and update config. 

## Scaleway

### Legacy `b_ssd` volumes support

Running `cloudypad provision` with Scaleway provider may yield error such as:

```
error: scaleway:instance/server:Server resource 'my-instance' has a problem: b_ssd volumes are not supported anymore. Remove explicit b_ssd volume_type, migrate to sbs or downgrade terraform.
```

This is caused by Scaleway deprecation of `b_ssd` volumes support which we can't create/update anymore. To workaround this issue, you can either:

- Follow [Scaleway migration guide](https://www.scaleway.com/en/docs/instances/how-to/migrate-volumes-snapshots-to-sbs/#migrating-using-the-instance-apicli-migration-endpoint-plan-and-apply)
- Use `cloudypad configure` instead of `cloudypad provision` or `cloudypad update` - Note that it will not fully update your instance since provision will be skipped, but it should work nonetheless
- Create a new instance (but you'll need to reinstall your games)