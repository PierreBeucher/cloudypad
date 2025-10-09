# Troubleshooting

## `cloudypad create` fails - how to resume or cancel creation ?


## Error on deploy/destroy/start/stop/provision: `ConcurrentUpdateError [...] stack is currently locked by 1 lock(s)...`

Error looks like:

```sh
ConcurrentUpdateError  code: -2
 stdout:
 stderr: Command failed with exit code 255: pulumi up --yes --skip-preview --refresh --color always ...
```

This may be caused by a previous action interruption (such as existing your shell session or killing process with CTRL+C). As an update was interrupted mid-process, a "lock" file preventing concurrent update was left behind. 

To cleanup lock file, run the same command again with `--force-pulumi-cancel`, eg.:

```sh
cloudypad destroy my-instance --force-pulumi-cancel [...]
cloudypad deploy my-instance --force-pulumi-cancel [...]
cloudypad deploy my-instance --force-pulumi-cancel [...]
```

**IMPORTANT NOTE:** some resources may have been left dangling (created on Cloud provider but they won't be managed by Cloudy Pad as we lost track of them following update interruption). **You may need additional manual cleanup: check your Cloud provider for unused resources to avoid unwanted costs**

You may also encounter some kind of `already exists` problem for the same reason (Pulumi trying to create an already existing resource), for example:

```sh
The security group 'CloudyPad-my-interrupted-stack' already exists for VPC 'vpc-xxx'
```

If this happens, delete the mentionned existing resource and try again.

## Not finding help here ? Create an issue on GitHub

If your problem persist or you don't find solution in documentation, please [create an issue on GitHub](https://github.com/PierreBeucher/cloudypad/issues)