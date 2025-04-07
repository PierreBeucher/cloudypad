# Auto Stop: inactivity detection and automatic shutdown

Inactivity detection (Auto Stop) automatically shuts down your instance when no activity is detected to avoid overcost.

Instance is considered inactive when all these conditions are met:
- You're not connected via Moonlight
- You're not downloading a game (no significant incoming network activity is detected)
- You're not updating the instance using `cloudypad` commands like `cloudypad configure` (to avoid interrupting instance during configuration or updates)

## Configuration

Enabling/disabling Auto Stop is done on instance creation via `cloudypad create <provider> --autostop-enable=[true|false] --autostop-timeout <seconds>` or interactive prompt.

To change configuration post-creation use `cloudypad update`, for example:

```sh
cloudypad update <provider> --name <my-insytance> --autostop-enable true --autostop-timeout 600
```

## How it works

Auto Stop regularly check for:
- Moonlight activity on port 47999 (Control Port). 
- Network download activity
- Ansible process activity used by `cloudypad` commands like `cloudypad configure` (to avoid shutting down instance during configuration or updates)

If no activity is detected within the configured timeout, Auto Stop will shut down the instance.

Auto Stop is installed as systemd service `cloudypad-autostop`. You can stop/start and get logs with:

```sh
sudo systemctl stop|start|status cloudypad-autostop
sudo journalctl -u cloudypad-autostop -f
```