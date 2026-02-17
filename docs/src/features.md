# Cloudy Pad features

## Supported game launchers

✅ Native stable launchers:

- [Steam](https://store.steampowered.com) - Steam client is installed natively on Cloudy Pad with a recent Proton version pre-configured.
- [Heroic](https://heroicgameslauncher.com) - Heroic Games Launcher is installed natively on Cloudy Pad and let you play games from:
  - Epic
  - GOG
  - Amazon Prime Games

✅ Other stable launchers:

- [Epic](https://www.epicgames.com) - Supported via Heroic Games Launcher
- [GOG](https://www.gog.com) - Supported via Heroic Games Launcher

Experimental launchers:

- [Lutris](https://lutris.net/) - Lutris is natively installed on Cloudy Pad, but is currently experimental and may require additional technical skills to configure

## Supported Cloud Providers and features

Supported Cloud providers, their smplementation status and features

|  Provider  |    Status    | Data Disk Snapshot | Base Image on init/update |   Cost Alerts  | Auto Stop | IPv6 Support |
|:----------:|:------------:|:------------------:|:-------------------------:|:--------------:|:---------:|:------------:|
|     AWS    |    ✅<br>stable    |          ✅         |             ✅             |        ✅       |     ✅     |              |
|    Azure   |    ✅<br>stable    |          ✅         |             ✅             |        ✅       |     ✅     |              |
|     GCP    |    ✅<br>stable    |          ✅         |             ✅             |        ✅       |     ✅     |              |
|  Scaleway  |    ✅<br>stable    |          ✅         |             ✅             |                |     ✅     |              |
|   Linode   | ℹ️ _experimental_ |                    |             ✅             |                |     ✅     |             |
| Paperspace |    ⚠️ _deprecated_    |                    |                           |                |     ✅     |              |
|     SSH    |    ✅<br>stable    |   _Not applicable_   |     _Not applicable_    |_Not applicable_|     ✅     |              |

### Cloud Provider features

All features are more or less related to Cost Efficiency 🤑

- **Data Disk Snapshot**: Snapshot instances's data disk on stop to reduce infrastructure cost.
  - Snapshot are cheaper than plain data disk / volumes
  - Data disk / volume is restored from snapshot on start
- **Base Image on Init/Update**: Create a base image on instance initialization and update
  - Keeping instance image is cheaper than keeping the instance and its OS/root disk on stop
  - Instance and OS / root disk is deleted on stop and re-created from base image on start
- **Cost Alerts**: Automated cost monitoring and email alerts when spending reaches configured thresholds
  - Avoid accidental spending and keep controler of what you spend
- **Auto Stop**: Automatic shutdown of instances when inactivity is detected (eg. stop instance after 15 min of inactivity)
  - Prevent your instance from costing money while not in use of if you go AFK
- **IPv6 Support**: Support for IPv6 networking and addressing
  - IPv4 are billed 1$ to 2$ / month on most Cloud providers. IPv6 is free !
  - _Not supported yet: coming soon!_

## Supported Streaming servers 

Stream with [Moonlight](https://moonlight-stream.org/) client from one of of these streaming server:

- [Sunshine](https://app.lizardbyte.dev/Sunshine/) - _low-latency, cloud gaming server capabilities with support for AMD, Intel, and Nvidia GPUs for hardware encoding._
- [Wolf](https://games-on-whales.github.io/wolf/stable/) - _open source streaming server for Moonlight that allows you to share a single server with multiple remote clients in order to play videogames!_

