# Running sudo and root commands

It's possible to run `sudo` and commands as `root` in Cloudy Pad, but there are **some important limitations as changes you make may not persist.**

## `sudo` and `root` command limitations

Changes made with `sudo` or as `root` user may no persist, for example an `apt` package installed once
may not be available the next time you run your instance. Here's why:

Cloudy Pad runs inside a container. This means that any packages you install or system updates you make outside of standard usage may **NOT persist**: the container may be re-created every time your instance starts or when you make a Cloudy Pad version upgrade. 

If you know what you are doing, go ahead! We'd actually love to hear about your sudo use cases: share them on [Discord](https://discord.gg/QATA3b9TTa) or [GitHub](https://github.com/PierreBeucher/cloudypad/issues) so we can consider integrating them natively in Cloudy Pad.

Keep in mind `sudo` commands can break things and we may not be able to provide support for issues caused by `sudo`-related usage.

## Persisting data

Persistent data can be stored under `$XDG_DATA_HOME`, this folder and its content will persist across sessions. It contains your games and user data - be careful not to break anything important!

## Get your sudo password

To get your `sudo` password in Cloudy Pad:

- Right click on desktop and run a terminal
- Run command:
```sh
get-cloudy-password
```
