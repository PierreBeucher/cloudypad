# Moonlight: install and connect

- [Download and install Moonlight](#download-and-install-moonlight)
- [Connect to your instance](#connect-to-your-instance)
  - [Cloudy Pad SaaS](#cloudy-pad-saas)
  - [Cloudy Pad CLI](#cloudy-pad-cli)
- [Moonlight usage and configuration](#moonlight-usage-and-configuration)
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

## Moonlight usage and configuration

See [Moonlight usage: screen size, latency, keyboard shortcuts, etc.](./moonlight-usage.md)
