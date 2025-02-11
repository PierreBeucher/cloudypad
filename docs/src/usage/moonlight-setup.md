# Moonlight setup and pairing guide

Cloudy Pad requires Moonlight streaming client to connect to your instance.

## Install Moonlight

Moonlight is available [Windows, MacOS and Linux](https://github.com/moonlight-stream/moonlight-qt/releases). 

[See Moonlight website](https://moonlight-stream.org/) for other installation methods.

## Run Moonlight and connect to your instance

Pairing is done automatically when you run `cloudypad create`.

If needed, can pair your instance using Cloudy Pad CLI:

```sh
cloudypad pair my-instance

# Run this command in another terminal to pair your instance:
#
#   moonlight pair 35.181.136.176 --pin 1234
```
