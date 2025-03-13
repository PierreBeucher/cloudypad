# Moonlight setup and pairing guide

Cloudy Pad requires Moonlight streaming client to connect to your instance.

## Install Moonlight

Moonlight is available [Windows, MacOS and Linux](https://github.com/moonlight-stream/moonlight-qt/releases). 

[See Moonlight installation instructions](../help/moonlight.md) for other installation methods.

## Run Moonlight and connect to your instance

Pairing is done automatically when you run `cloudypad create`.

If needed, can pair your instance using Cloudy Pad CLI:

```sh
cloudypad pair my-instance

# Run this command in another terminal to pair your instance:
#
#   moonlight pair 35.181.136.176 --pin 1234
```

## Mac and Apple specificities

Some Mac / Apple device may prevent Moonlight to pair on non-local address. To workaround this, use an IPv6 address instead of the default IPv4 address when pairing by prefixing with `[::ffff:[YOUR_IP]]`.

For example this IPv4

```
200.123.4.56
```

Becomes Ipv6

```
[::ffff:200.123.4.56]
```