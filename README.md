# Cloudy Pad
[![Discord](https://img.shields.io/discord/856434175455133727?style=for-the-badge&logo=discord&logoColor=ffffff&label=Chat%20with%20us%20on%20Discord&labelColor=6A7EC2&color=7389D8)](https://discord.gg/QATA3b9TTa)
[![GitHub License](https://img.shields.io/github/license/PierreBeucher/cloudypad?style=for-the-badge&color=00d4c4)](./LICENSE.txt)

Cloudy Pad lets you **deploy a Cloud gaming instance on your own servers, machines or directly in the Cloud** (AWS, Azure, Google Cloud, Scaleway...) and **play your own Steam, Epic, GOG and other games** - without requiring a powerful gaming machine or a costly subscription.

**Not familiar with Cloud Gaming ?** See [What's Cloud Gaming and how is Cloudy Pad useful ?](./docs/src/what-is-cloud-gaming.md)

- [Features](#features)
- [Getting started 🚀](#getting-started-)
- [Have a question ? Found a bug ?](#have-a-question--found-a-bug-)
- [Contributing](#contributing)
- [Contributors](#contributors)
- [License](#license)

---

[![](./docs/src/assets/demo.gif)](https://docs.cloudypad.gg)

---

## Features

- Supported Games Launchers:
  - [Steam](https://store.steampowered.com)
  - [Epic](https://www.epicgames.com)
  - [GOG](https://www.gog.com)
  - [Heroic](https://heroicgameslauncher.com)
  - [Lutris](https://lutris.net/)
- **Turn your own server or machine into a Cloud gaming instance**
  - Install directly on any server via SSH
- Supported Cloud Providers:
  - AWS
  - Azure
  - Google Cloud Platform (GCP)
  - Scaleway
  - Paperspace
- Cloud Cost optimisations:
  - Setup automated **Cost alerts** to avoid overspending 💸
  - Use **Spot instances** for up to **90% cheaper** instances
  - Play **30 hours per month** for **~15$ / month or less**
  - Control network speed to limit egress cost on providers charging outbound transfer
- **Pay by the hour, no subscription** required
- Deploy a [Sunshine](https://app.lizardbyte.dev/Sunshine/) or [Wolf](https://games-on-whales.github.io/wolf/stable/) video-game streaming server
- Stream with [Moonlight](https://moonlight-stream.org/) client

## Getting started 🚀

[⚒️ Self-deploy your instance via CLI](https://docs.cloudypad.gg/getting-started)

[🪄 Cloudy Pad App: deploy your instance in seconds from your browser and start playing 🎮](https://app.cloudypad.gg/sign-in)

[📜 See full documentation](https://docs.cloudypad.gg)

## Have a question ? Found a bug ?

- See [FAQ and known issues](https://docs.cloudypad.gg/usage/faq.md) or [create an issue](https://github.com/PierreBeucher/cloudypad/issues)
- Come and chat with us on [Discord](https://discord.gg/QATA3b9TTa) !

## Contributing

A [complete contribution guide](https://docs.cloudypad.gg/contributing/contribution-guide.html) is available with:

- Development environment setup (fully automated with Nix)
- Project architecture
- Common contribution scenarios
- How and where to write code
- Testing and debugging
- Tips and helps

Cloudy Pad involves usage of:

- TypeScript & NodeJS
- Cloud providers: AWS, Azure, GCP, Scaleway...
- Ansible
- Docker
- Pulumi (an Infrastructure as Code tool like Terraform using real Typescript/NodeJS code)

See [Contribution guide](https://docs.cloudypad.gg/contributing/contribution-guide.html) ([plain markdown version](./docs/src/contributing/contribution-guide.md))

## Contributors

Thanks to our contributors

[![Code Contributors](https://contrib.rocks/image?repo=PierreBeucher/cloudypad)](https://github.com/PierreBeucher/cloudypad/graphs/contributors)

## License

Cloudy Pad is licensed under [GNU General Public License v3.0](https://github.com/PierreBeucher/cloudypad/blob/master/LICENSE.txt)

A business-oriented license is also available, please reach to `pierre@cloudypad.gg`

COUCOU