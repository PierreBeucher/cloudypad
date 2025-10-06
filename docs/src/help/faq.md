## FAQ

- [FAQ](#faq)
  - [What are the recommended GPU and specs for my instance ?](#what-are-the-recommended-gpu-and-specs-for-my-instance-)
    - [AWS](#aws)
    - [Paperspace](#paperspace)
    - [Azure](#azure)
    - [Google Cloud](#google-cloud)
    - [Scaleway](#scaleway)
  - [I can't sign-in to my Steam account](#i-cant-sign-in-to-my-steam-account)
  - [Using Steam, why does my game take forever to "cache Vulkan shader" ?](#using-steam-why-does-my-game-take-forever-to-cache-vulkan-shader-)
  - [I have a black screen when I connect to my instance](#i-have-a-black-screen-when-i-connect-to-my-instance)
  - [I Found an bug or I have a suggestion](#i-found-an-bug-or-i-have-a-suggestion)
  - [How does all of this work?](#how-does-all-of-this-work)
  - [Will Cloudy Pad become a paid product ?](#will-cloudy-pad-become-a-paid-product-)
  - [How are my data collected? How does analytics works?](#how-are-my-data-collected-how-does-analytics-works)
- [Known issues](#known-issues)

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

#### Scaleway

Scaleway  `GPU-3070-S` (NVIDIA RTX 3070, 8 CPUs, 16 GB RAM) and `L4-1-24G` (NVIDIA L4 GPU, 8 CPUs, 48 GB RAM) are great for gaming. 

Scaleway also provide instances with multiple GPU or powerful and expensive GPUs like H100 but they may not be the best choice for gaming (expensive and not designed for gaming).

### I can't sign-in to my Steam account

Steam may prevent sign-in as it detect your server location is not your "usual" location. It's recommended to use Steam Guard Mobile Authenticator to approve of your instance location: [Steam sign-in tutorial](../game-launchers/steam.md)

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

Cloudy Pad is a Free and Open Source project. However it deploys Cloud resources on providers like AWS, Azure, Google Cloud, Scaleway etc. which are usually not free.

[Cloudy Pad Platform](https://app.cloudypad.gg/sign-in) provides an experience similar to other Cloud Gaming services, based on Cloudy Pad Open Source. Like a Cloud Provider, payment is done by the hour based on resource consumption.

_Note from the creator: Considering I'm really not happy about the [enshittification of the internet](https://en.wikipedia.org/wiki/Enshittification), Cloudy Pad will remain a Free and Open Source project along Cloudy Pad platform._

### How are my data collected? How does analytics works?

Cloudy Pad may, with your consent, collect some personal information. Here's the full list of information collected if you consent:
- OS name and details (distribution and version)

This data is only used internally and won't be shared with third party or used for targeted ads. Your data are only used for analytics purpose to understand usage, track feature usage and help resolve issues.

Cloudy Pad will, by default, collect technical data such as when a command is run or certain technical event occurs, _without collecting any personal information._ Collected data:
- Cloudy Pad version
- Techical events (action performed such as instance start/stop without instance details, error without personal info, etc.)

To completely opt out of any data collection (even technical non-personal data) or change data collection method, open `$HOME/.cloudypad/config.yml` and set `analytics.enabled: false`, eg:

```sh
analytics:
  posthog:
    collectionMethod: none # <<===== EDIT HERE, valid value: "none", "technical", "all"
    distinctId: xxx
```

Cloudy Pad uses [Post Hog](https://posthog.com) and will keep data for 1 or 3 months. 

To opt-out of analytics, either:
- Refuse analytics on initial installation
- Export environment variable `CLOUDYPAD_ANALYTICS_DISABLE=true`
- Edit local configuration at `$HOME/.cloudypad/config.yml` and set `analytics.enabled: false`

## Known issues

Moved to [known-issues.md](known-issues.md)