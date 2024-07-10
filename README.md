# Cloudy Pad

Your own gaming box in the Cloud ! 🎮 ⛅ 

- [Development status 🧪](#development-status-)
- [Features ✨](#features-)
- [Getting started 🚀](#getting-started-)
  - [Gaming servers](#gaming-servers)
    - [Wolf 🐺](#wolf-)
    - [Sunshine 🌤️](#sunshine-️)
    - [Other Gaming servers ?](#other-gaming-servers-)
- [FAQ](#faq)
  - [How much will I pay ? 🫰](#how-much-will-i-pay--)
  - [Will Cloudy Pad become a paid product ?](#will-cloudy-pad-become-a-paid-product-)
- [License](#license)

## Development status 🧪

This project is still at an experimental phase. While working and allowing you to play in the Cloud seamlessly, there may be breaking changes in the future. Feel free to contribute and provide feedback !

## Features ✨

Compatible with [Moonlight](https://moonlight-stream.org/) streaming client

Gaming servers:

- 🐺 [Wolf](https://games-on-whales.github.io/wolf/stable/)

Cloud providers:

- [AWS](https://aws.amazon.com/)
- (available soon) [Azure](https://azure.microsoft.com)
- (available soon) [Google Cloud](https://cloud.google.com)

## Getting started 🚀

Prerequisites:
- A Clouder account (eg. [AWS](https://aws.amazon.com/))
- Make sure you [understand the costs 💸](#how-much-will-i-pay--) of running a gaming instance in the Cloud


### Gaming servers

#### Wolf 🐺

[Wolf](https://games-on-whales.github.io/wolf/stable/index.html) is _an open source streaming server for Moonlight that allows you to share a single server with multiple remote clients in order to play videogames_. It works via containers to provide various services such as Steam Big Picture.

#### Sunshine 🌤️

[Sunshine](https://github.com/LizardByte/Sunshine) is a _self-hosted game stream host for Moonlight_. You can install anything on your instance (eg. Steam or other) and stream it with Moonlight.

#### Other Gaming servers ?

This project intend to support [Parsec](https://parsec.app/). Feel free to propose other gaming servers !

## FAQ

### How much will I pay ? 🫰

Cloudy-Pad is free and open-source, however charges may apply when using a Cloud provider. Here's an estimation for AWS:

| Gaming time / month      | 15h        | 20h        | 20h        | 30h        |
|--------------------------|------------|------------|------------|------------|
| EC2 instance type        | g5.xlarge  | g5.xlarge  | g5.2xlarge | g5.2xlarge |
| Disk size (gp3 SSD)      | 100 Go     | 100 Go     | 100 Go     | 100 Go     |
| EC2 instance $           | $18.87     | $25.16     | $30.31     | $45.47     |
| Route53 record $         | $0.00      | $0.00      | $0.00      | $0.00      |
| EC2 volume (disk) $      | $9.52      | $9.52      | $9.52      | $9.52      |
| EIP address $            | (no eip)   | $3.50      | (no eip)   | $3.45      |
| **Est. TOTAL / month $** | **~$28** | **~$38** | **~$40** | **~$58** |

_*Estimation based on eu-central-1 (Frankfurt) pricing in December 2023. Exact prices vary with time and regions._

**This project's goal is to provide 20h / month for 20$** - [Paperspace](https://www.paperspace.com/pricing) and [TensorDock](https://www.tensordock.com/) are good bets, but not ready to use yet.  

Equivalent estimation for other providers will be added as they become ready.


### Will Cloudy Pad become a paid product ?

Probably not in it's current form. Considering I'm really _not_ happy about the [enshittification of the internet](https://en.wikipedia.org/wiki/Enshittification), Cloudy Pad will remain FOSS - at least for personal use.

However, the larger Cloudy Box scope may become a paid product for professional use cases, not necessarily linked to gaming.

## License

[GNU GENERAL PUBLIC LICENSE](./LICENSE.txt)