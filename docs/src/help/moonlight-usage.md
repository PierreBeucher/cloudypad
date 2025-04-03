# Moonlight usage: screen size, latency, keyboard shortcuts, etc.

- [How to exit Moonlight session](#how-to-exit-moonlight-session)
- [Display / screen resolution](#display--screen-resolution)
- [Latency, stutter and image quality: FPS and bitrate](#latency-stutter-and-image-quality-fps-and-bitrate)
- [Moonlight keyboard shortcuts](#moonlight-keyboard-shortcuts)
- [See also](#see-also)

## How to exit Moonlight session

Press:

- PC / Windows keyboard :`CTRL+ALT+SHIFT+Q`
- MacOS keyboard: `SHIFT+CONTROL+OPTION+Q`

## Display / screen resolution

Moonlight screen resolution may be different than your actual screen. **By default Moonlight is configured to use a 720p resolution (`1280x720`) which may be lower than your actual screen**. 

If you experience blurry image and/or improperly scaled image, Moonlight resolution may be improperly set.

To set Moonlight display resolution:

- Open Moonlight client.
  - If already connected to your instance in Moonlight, [exit your session](#how-to-exit-moonlight-session) and **click _Stop_ button to fully disconnect**.
- Open _Settings_ ⚙️ (top-right gear button).
- Under _"Resolution and FPS"_ choose your desired resolution. Use the following values:
  - `Native` to match your current screen resolution
  - `1080p` for `1920x1080` screen resolution
  - `4k` for `3840x2160` screen resolution

Known limitations:

- NVIDIA Datacenter GPUs maximum resolution is 2560x1600. Resolution will automatically be adjusted to fit your screen but may be smaller as it will be capped at 2560x1600. See [#144](https://github.com/PierreBeucher/cloudypad/issues/144).

## Latency, stutter and image quality: FPS and bitrate

Moonlight has a "FPS" and "Bitrate" limit. Setting these values may improve your connection quality / latency:

If you experience lag, stutter or warnings while streaming:

- Open Moonlight client.
  - If already connected to your instance in Moonlight, [exit your session](#how-to-exit-moonlight-session).
- Open settings ⚙️ (top-right gear button).
- Decrease bitrate by ~10% to 30%.
  - Slightly lower quality but better latency for slower internet connections.
- Decrease FPS (eg. 60 FPS => 40 FPS)
  - FPS is "Frame per second". Lower FPS means less data to sent but slightly lower quality.
- Decrease resolution (eg. 1080p => 720p)
  - Lower resolution means less data to sent but slightly lower quality.

## Moonlight keyboard shortcuts

PC / Windows keyboard:

- Exit session: `CTRL+ALT+SHIFT+Q`
- Show statistics (FPS, latency, etc.): `CTRL+ALT+SHIFT+S`
- Windowed mode: `CTRL+ALT+SHIFT+X`

MacOS keyboard:

- Exit session: `SHIFT+CONTROL+OPTION+Q`
- Show statistics (FPS, latency, etc.): `SHIFT+CONTROL+S`
- Windowed mode: `SHIFT+CONTROL+OPTION+X`

## See also

- [Moonlight: install and connect](./moonlight-install-connect.md)
- [Official Moonlight troubleshooting]([./moonlight-troubleshooting.md](https://github.com/moonlight-stream/moonlight-docs/wiki/Troubleshooting))
