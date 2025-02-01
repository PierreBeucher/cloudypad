# Streaming servers: Sunshine and Wolf

Cloudy Pad supports two streaming servers:
- [Sunshine](https://github.com/LizardByte/Sunshine)
- [Wolf](https://games-on-whales.github.io/wolf/stable/)

You can choose between them when creating your instance on prompt or by passing `--streaming-server [sunshine|wolf]` flag to `cloudypad create`.

## Sunshine

[Sunshine](https://github.com/LizardByte/Sunshine) is a modern streaming server that supports a wide range of games and is known to be very stable. It provides a web interface to manage configuration.

### Accessing web interface and configuration

For security reasons Sunshine interface is not exposed on the internet. You must run an SSH tunnel to access it:

Get your instance IP address:

```sh
$ cloudypad get <instance-name>
```

Showing something like this:

```json
{
  "provision": {
    "output": {
      "host": "10.234.56.78", // <INSTANCE_IP>
    },
    // [...]
  },
  "configuration": {
    "input": {
      "sunshine": {
        "passwordBase64": "c3Vuc2hpbmU=",
        "username": "sunshine"
        // [...]
      }
    }
  }
}
```

Decode base64 password:

```sh
echo "c3Vuc2hpbmU=" | base64 -d
# sunshine
```

Run an SSH tunnel:

```sh
$ ssh -L 47990:localhost:47990 <INSTANCE_IP>
```

Open your browser and go to `https://localhost:47990`. Sunshine's default certificate will probably not be trusted by your browser as it's self-signed, you can safely ignore this error. 

Use login/password entered during instance creation, also shown by `cloudypad get <instance-name>`.

Note: future versions of Cloudy Pad will either:
- Allow secure remote access via internet with valid HTTPS (TLS) certificate
- More automation to run SSH tunnel for you

## Wolf

[Wolf](https://games-on-whales.github.io/wolf/stable/) is a Moonlight-compatible streaming server. Main features include allowing multiple users to stream from the same instance and sharing a single GPU with multiple games.