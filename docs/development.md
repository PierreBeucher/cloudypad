## Development

### Quick run without compilation

```sh
npx tsx src/main.ts [ARGS...]
```

### Test NixOS config

```sh
nix-instantiate '<nixpkgs/nixos>' -A config.system.build.toplevel -I nixpkgs=channel:nixos-23.05 --arg configuration ./configs/nix/wolf-aws.nix
```

Manage underlying Pulumi stacks:

```sh
pulumi stack ls -a
pulumi destroy -s full-stack-name
pulumi stack output -s full-stack-name
pulumi stack rm full-stack-name
```

### Generate Paperspace client

Paperspace client is generated from OpenAPI specifications:

```sh
task paperspace-client-gen
```

### Sunshine

#### Get Sunshine service status and logs

```sh
# Show sunshine user journal (e.g. sunshine server logs and other useful debug info)
journalctl _UID=1001 -b

# Get user systemd service status and logs 
su sunshine
journalctl --user -u sunshine
systemctl --user status sunshine

# List user services
systemctl --user --machine=<username>@ list-units --type=service
```

#### Run Sunshine interactively via SSH

```sh
# Access display
export DISPLAY=:0

# Retrieve X authority file
ps -ef | grep Xauthority
cp /run/user/1000/gdm/Xauthority ~/.Xauthority

# Get command used to start sunshine (wrapper script)
cat /etc/systemd/user/sunshine.service 
# ...
# ExecStart=/run/wrappers/bin/sunshine /nix/store/pqyi3jwp47zsis33asq8hn2i01zdygcd-sunshine.conf/config/sunshine.conf
# ...

# Run sunshine with or without wrapper and conf
/run/wrappers/bin/sunshine /nix/store/90vsycwg87c82jldkg0ssl0a19a884lp-sunshine.conf/config/sunshine.conf
```

#### Debug X displays

Find auth file (`-auth`) and use it as `XAUTHORITY`:

```sh
$ ps -ef | grep X
sunshine    1552    1178  0 20:47 ?        00:00:00 /nix/store/phqj3gdb9p5467zny78awnqmqrx2klrd-xwayland-24.1.0/bin/Xwayland :0 -rootless -noreset -accessx -core -auth /run/user/1001/.mutter-Xwaylandauth.1LXEQ2 -listenfd 4 -listenfd 5 -displayfd 6 -listenfd 7 -byteswappedclients -enable-ei-portal

$ export XAUTHORITY=/run/user/1001/.mutter-Xwaylandauth.1LXEQ2
$ export DISPLAY=:0

$ xrandr # works !
```

