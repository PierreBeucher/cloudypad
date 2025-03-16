# Moonlight: download, install, pair and connect to your instance

You need to install Moonlight to connect to your instance. Moonlight is the client used to connect to your Cloudy Pad instance.

- [Download and install Moonlight](#download-and-install-moonlight)
- [Connect to your instance](#connect-to-your-instance)
  - [Cloudy Pad SaaS](#cloudy-pad-saas)
  - [Cloudy Pad CLI](#cloudy-pad-cli)
- [Display / screen resolution - Why is Cloudy Pad screen resolution lower / different than my screen?](#display--screen-resolution---why-is-cloudy-pad-screen-resolution-lower--different-than-my-screen)
- [Moonlight keyboard shortcuts](#moonlight-keyboard-shortcuts)
- [Connection latency, FPS and bitrate](#connection-latency-fps-and-bitrate)
- [See also](#see-also)

## Download and install Moonlight

Moonlight is available for:
- [Windows](https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/MoonlightSetup-6.1.0.exe)
- [MacOS](https://github.com/moonlight-stream/moonlight-qt/releases/download/v6.1.0/Moonlight-6.1.0.dmg)
- [Linux](https://github.com/moonlight-stream/moonlight-qt/releases)
- [Other platforms](https://github.com/moonlight-stream/moonlight-qt/releases)

See [Official Moonlight website](https://moonlight-stream.org/#) for more information.

## Connect to your instance

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

## Display / screen resolution - Why is Cloudy Pad screen resolution lower / different than my screen?

Moonlight let you choose your desired resolution. 

**By default Moonlight may be configured to use a lower resolution than your actual screen**, to update:

- Open Moonlight client.
- Open settings ⚙️ (top-right gear button).
- Under "Resolution and FPS" choose your desired resolution. Use the following values:
  - Native to match your current screen resolution
  - 1080p for 1920x1080 screen resolution
  - 4k for 3840x2160 screen resolution

Known limitations:

- NVIDIA Tesla GPUs maximum resolution is 2560x1600. If you have a higher resolution screen, you may experience black borders. See [this issue](https://github.com/PierreBeucher/cloudypad/issues/144) for more information.

## Moonlight keyboard shortcuts

- Exit session: `CTRL+ALT+SHIFT+Q`
- Show statistics (FPS, latency, etc.): `CTRL+ALT+SHIFT+S`
- Windowed mode: `CTRL+ALT+SHIFT+X`

## Connection latency, FPS and bitrate

Moonlight client set the FPS and bitrate automatically.

## See also

- [Official Moonlight troubleshooting]([./moonlight-troubleshooting.md](https://github.com/moonlight-stream/moonlight-docs/wiki/Troubleshooting))
