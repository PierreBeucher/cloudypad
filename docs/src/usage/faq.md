## FAQ

- [FAQ](#faq)
  - [What are the recommended GPU and specs for my instance ?](#what-are-the-recommended-gpu-and-specs-for-my-instance-)
    - [AWS](#aws)
    - [Paperspace](#paperspace)
    - [Azure](#azure)
    - [Google Cloud](#google-cloud)
  - [How can I log-in to Steam?](#how-can-i-log-in-to-steam)
  - [How to play game on Steam / Why does my Steam game doesn't launch ?](#how-to-play-game-on-steam--why-does-my-steam-game-doesnt-launch-)
  - [Using Steam, why does my game take forever to "cache Vulkan shader" ?](#using-steam-why-does-my-game-take-forever-to-cache-vulkan-shader-)
  - [I have a black screen when I connect to my instance](#i-have-a-black-screen-when-i-connect-to-my-instance)
  - [I Found an bug or I have a suggestion](#i-found-an-bug-or-i-have-a-suggestion)
  - [How does all of this work?](#how-does-all-of-this-work)
  - [Will Cloudy Pad become a paid product ?](#will-cloudy-pad-become-a-paid-product-)
  - [How are my data collected? How does analytics works?](#how-are-my-data-collected-how-does-analytics-works)
- [Known issues](#known-issues)
  - [Docker for MacOS and VirtioFS](#docker-for-macos-and-virtiofs)


### What are the recommended GPU and specs for my instance ?

General recommendations:
- Choose a location or region as close as possible to you to avoid too much latency (eg. if you live in the US don't create your instance in Europe)
- Just provision what you need for: don't create a 500 GB disk if you intend to play a game that will only use 100 GB. 
- GPU / machine type depends on the game you play. See below for recommendations.

#### AWS

`xlarge` instances should be enough for most usage. For instance, `g4dn.xlarge` can run Baldur's Gate 3 in Ultra with 60 FPS 1080 without issues. Use a larger instance only if you have latency related to resource consumption. 

#### Paperspace

Paperspace `RTX4000` or `P4000` or `M4000` are relatively cheap and powerful enough for most use. A `P4000` can run Baldur's Gate 3 in Ultra with 60 FPS 1080 without issues.

Use higher-tier instance if you have latency related to resource consumption.

#### Azure

Use NC or NV instances with 4 to 8 CPUs, eg. one of:

- NC4as T4 v3 (4 CPU, 28 GB RAM)
- NC8as T4 v3 (8 CPU, 56 GB RAM)
- NV6ads A10 v5 (6 CPU, 55GB RAM)

Azure provide more opwerful instance but they are likely too expansive (providing lots of memory and ephemeral storage which is likely unused for gaming but expensive).

Azure gaming instances NG are not yet supported (they use AMD GPU while only NVIDIA is supported for now)

#### Google Cloud

Use N1 Standard instances with 4 to 16 CPUs with T4 or P4 GPUs. They are the cheapest while providing a good experience, eg. a P4 with 15GB RAM and 8 CPU can run Baldur's Gate 3 in Ultra with 60 FPS.

### How can I log-in to Steam?

When you run Steam, you'll be prompted to login either via QR code or login/password. You can either:

- Enter your login / password manually
- Use the Steam app to login via QR code: download and login with the Steam app on your smartphone, then click on the Steam Guard icon (shield icon at the bottom) and scan the QR code shown. 

### How to play game on Steam / Why does my Steam game doesn't launch ?

In order to play games on Steam you may need to enable Proton:

- Go to game properties (_Gear button on the right > Properties_)
- Enable Proton in the Compatibility menu

It's recommended to check your game Proton compatibility on [ProtonDB](https://www.protondb.com/). You may need to add a few Launch options (_Game properties > General > Launch options_).

### Using Steam, why does my game take forever to "cache Vulkan shader" ?

If this is the first time you run your game this is (unfortunately) expected. Steam may cache Vulkan shaders to optimize in-game performance. It should be faster on subsequent runs, if not instantaneous. 

### I have a black screen when I connect to my instance

If this is the first time you connect to your instance, it may take a few minutes to setup the required components. If after 5 min the problem persists, please file an issue. 

### I Found an bug or I have a suggestion

If you found a bug or have a suggestion, [please report an issue](https://github.com/PierreBeucher/cloudypad/issues). Thanks for your feedback !

### How does all of this work?

`cloudypad` is a wrapper around a few technologies:

- [Wolf](https://games-on-whales.github.io/wolf/stable/) gaming server
- Clouder-specific tools and APIs to deploy and manage Cloud machines
- When possible, [Pulumi](https://www.pulumi.com/) to deploy Cloud machines and resources
- [Ansible](https://www.ansible.com/) to configure machines (drivers, gaming server, etc.)
- 🧠 Brain juice from me and other awesome open-source community members

### Will Cloudy Pad become a paid product ?

Probably not in its current form. Considering I'm really _not_ happy about the [enshittification of the internet](https://en.wikipedia.org/wiki/Enshittification), Cloudy Pad will remain FOSS - at least for personal use.

Cloudy Pad may have a Premium or Pro offer in the future, but for a personal simple use it will remain FOSS.

### How are my data collected? How does analytics works?

Cloudy Pad may, upon your initial agreement on install, collect anonymous usage data. This data is only used internally and won't be shared with third party or used for targeted ads. Allowing anonymous data collection helps Cloudy Pad get better !

Cloudy Pad uses [Post Hog](https://posthog.com) and will keep data for 1 or 3 months. 

To opt-out of analytics, either:
- Refuse analytics on initial installation
- Export environment variable `CLOUDYPAD_ANALYTICS_DISABLE=true`
- Edit local configuration at `$HOME/.cloudypad/config.yml` and set `analytics.enabled: false`

## Known issues

### Docker for MacOS and VirtioFS 

For MacOS, if your Docker installation use VirtioFS, Cloudy Pad may fail with a Docker-related error such as: 

```
Error response from daemon: error while creating mount source path '/private/tmp/com.apple.launchd.ABCDEF/Listeners': mkdir /private/tmp/com.apple.launchd.ABCDEF/Listeners: operation not supported
```

This is a bug when using Docker for Mac VirtioFS file sharing with SSH agent. The bug is still being worked on, as a workaround you can either:

- Disable SSH agent before running Cloudy Pad, eg. `unset SSH_AUTH_SOCK`
- Switch Docker for Mac config to non-VirtioFS (eg. gRPC FUSE): go to _config > Resources > File Sharing_ and update config. 