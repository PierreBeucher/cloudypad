# Moonlight setup and pairing guide

Cloudy Pad requires Moonlight streaming client to connect to your instance.

## Install Moonlight

Moonlight is available [Windows, MacOS and Linux](https://github.com/moonlight-stream/moonlight-qt/releases). 

[See Moonlight installation instructions](../help/moonlight-install-connect.html) for other installation methods.

## Run Moonlight and connect to your instance

Pairing is done automatically when you run `cloudypad create`. If you need to pair again, follow these steps.

### Step 1: Start pairing

```sh
cloudypad pair my-instance
```

Choose **automatic** pairing when prompted. Cloudy Pad will generate a PIN and display a command like:

```sh
moonlight pair 35.181.136.176 --pin 1234
```

### Step 2: Run the Moonlight pair command

Run the `moonlight pair` command shown above in a separate terminal **while `cloudypad pair` is still waiting**. Both sides need to complete the handshake together.

`moonlight pair` handles both pairing and adding the instance — after it completes, your instance will appear in Moonlight ready to connect.

> **Important:** do not use Moonlight's GUI to initiate pairing (clicking the padlock icon on an instance). That flow requires entering a PIN in Sunshine's web interface, which is not directly accessible. Always use `cloudypad pair` and the `moonlight pair --pin` command instead.

> **Note:** Cloud instances are not on your local network so Moonlight will not discover them automatically. If your instance does not appear after pairing, open Moonlight, click **+**, and enter the IP address shown by `cloudypad list`.

### Step 3: Connect

Click your instance in Moonlight to connect and start streaming.

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