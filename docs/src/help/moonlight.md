# Moonlight: download, install, pair and connect to your instance

You need to install Moonlight to connect to your instance. Moonlight is the client used to connect to your Cloudy Pad instance.

## Download and install Moonlight

Moonlight is available for:
- [Windows](https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/MoonlightSetup-6.1.0.exe)
- [MacOS](https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/Moonlight-6.1.0.dmg)
- [Linux](https://github.com/moonlight-stream/moonlight-qt/releases)
- [Other platforms](https://github.com/moonlight-stream/moonlight-qt/releases)

See [Official Moonlight website](https://moonlight-stream.org/#) for more information.

## Connecting to your instance

You must pair your instance with Moonlight before you can connect to it.

### Cloudy Pad SaaS

Using [app.cloudypad.gg](https://app.cloudypad.gg), you can pair your instance via the web UI. Click on "Connect" button and follow instructions.

### Cloudy Pad CLI

Pairing is done automatically when you run `cloudypad create`.

If needed, can pair your instance using Cloudy Pad CLI:

```sh
cloudypad pair my-instance

# Run this command in another terminal to pair your instance:
#
#   moonlight pair 35.181.136.176 --pin 1234
```

## Moonlight keyboard shortcuts

- Exit session: `CTRL+ALT+SHIFT+Q`
- Show statistics (FPS, latency, etc.): `CTRL+ALT+SHIFT+S`
- Windowed mode: `CTRL+ALT+SHIFT+X`

## See also

- [Official Moonlight troubleshooting]([./moonlight-troubleshooting.md](https://github.com/moonlight-stream/moonlight-docs/wiki/Troubleshooting))
