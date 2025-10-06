# Known issues

- [Apple / MacOS](#apple--macos)
  - [Docker for MacOS and VirtioFS](#docker-for-macos-and-virtiofs)

## Apple / MacOS

### Docker for MacOS and VirtioFS 

For MacOS, if your Docker installation use VirtioFS, Cloudy Pad may fail with a Docker-related error such as: 

```
Error response from daemon: error while creating mount source path '/private/tmp/com.apple.launchd.ABCDEF/Listeners': mkdir /private/tmp/com.apple.launchd.ABCDEF/Listeners: operation not supported
```

This is a bug when using Docker for Mac VirtioFS file sharing with SSH agent. The bug is still being worked on, as a workaround you can either:

- Disable SSH agent before running Cloudy Pad, eg. `unset SSH_AUTH_SOCK`
- Switch Docker for Mac config to non-VirtioFS (eg. gRPC FUSE): go to _config > Resources > File Sharing_ and update config. 