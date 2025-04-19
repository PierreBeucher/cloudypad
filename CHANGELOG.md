# Changelog

## [0.24.0](https://github.com/PierreBeucher/cloudypad/compare/v0.23.0...v0.24.0) (2025-04-19)


### Features

* dedicated data disk and automated data migration (Scaleway only, other providers support coming soon) ([2b0c469](https://github.com/PierreBeucher/cloudypad/commit/2b0c4691344942db02a398cb4c4355514ae4a1ab))
* update Wolf streaming server version ([d6d17d2](https://github.com/PierreBeucher/cloudypad/commit/d6d17d2c0bf8d4d40f4bcf3ae7557965cafb6a5e))
* use local PULUMI_BACKEND_URL and PULUMI_CONFIG_PASSPHRASE env v… ([f692fe5](https://github.com/PierreBeucher/cloudypad/commit/f692fe527b0f9d395c81960965022e825980b607))
* use local PULUMI_BACKEND_URL and PULUMI_CONFIG_PASSPHRASE env vars if any ([13c7976](https://github.com/PierreBeucher/cloudypad/commit/13c79765b2428b1b1273f7ba11a128109e8ba9a9))


### Bug Fixes

* do not list incompatible Azure instance types ([900d764](https://github.com/PierreBeucher/cloudypad/commit/900d764d481558acceee8f3abcbdfd998673c6a3))
* longer timeout for AWS instance stop wait ([70eb238](https://github.com/PierreBeucher/cloudypad/commit/70eb238e1fe54594fdfb8e1953f1b15da3bbfb66))
* **scaleway:** avoid NVIDIA drivers .run install because of unwanted system driver packages (use wildcard to detect unwanted packages) ([2b05a69](https://github.com/PierreBeucher/cloudypad/commit/2b05a6928d5486fc433cc55c833239efb84749e9))
* **scaleway:** don't add Docker repository causing conflicting keys ([8383cee](https://github.com/PierreBeucher/cloudypad/commit/8383ceee1ff3ab7d726c7252c0adc770ea8e5053))

## [0.23.0](https://github.com/PierreBeucher/cloudypad/compare/v0.22.0...v0.23.0) (2025-04-13)


### Features

* **scaleway:** use custom server image ([e6b65ce](https://github.com/PierreBeucher/cloudypad/commit/e6b65ce9debb51e4bfffd6932e5d51e12ddbac0d))


### Bug Fixes

* **sunshine:** corrected screen selection which is not always primary ([8fd4a86](https://github.com/PierreBeucher/cloudypad/commit/8fd4a86a1986603da0b78f4bd39afc98a2b30aba))

## [0.22.0](https://github.com/PierreBeucher/cloudypad/compare/v0.21.1...v0.22.0) (2025-04-07)


### Features

* auto resize desktop icon to match current screen size ([268fcc0](https://github.com/PierreBeucher/cloudypad/commit/268fcc0371be7e5eddb84221fe16aeb150cf4c63))
* **autostop:** detect Ansible running on host to avoid interruption while Ansible is running ([0f1d78a](https://github.com/PierreBeucher/cloudypad/commit/0f1d78ae42f9e13d429107a15f5522e9cb86f188))
* exit button shows how to exit rather than killing container ([50df2a2](https://github.com/PierreBeucher/cloudypad/commit/50df2a2e40e2e24ae2310db690c000b8b883aad5))
* **sunshine:** add Help button directing to docs.cloudypad.gg ([b728883](https://github.com/PierreBeucher/cloudypad/commit/b7288830c000615be0b594767ddf337f9dacd790))
* **sunshine:** start Steam on Library view by default ([42e35ff](https://github.com/PierreBeucher/cloudypad/commit/42e35ff111ff52746d67ad3e9141879b2b771c2e))


### Bug Fixes

* disable pulseaudio autostart ([f38ff9b](https://github.com/PierreBeucher/cloudypad/commit/f38ff9b1a384bcfa2babb9ead0150afa653a4488))
* **nvidia-drivers:** avoid breaking NVIDIA drivers on Linux kernel change (eg. with unattended upgrades) ([b4759c8](https://github.com/PierreBeucher/cloudypad/commit/b4759c86cb67d469f394754b9804e8189f7042dd))

## [0.21.1](https://github.com/PierreBeucher/cloudypad/compare/v0.21.0...v0.21.1) (2025-03-22)


### Bug Fixes

* **cli:** missing keyboard and locale flags on some create/update commands ([68d9556](https://github.com/PierreBeucher/cloudypad/commit/68d9556f4c1a56b6652678fa71b417877903a1bf))
* prevent pulseaudio from quitting before over components starts ([2aa5c62](https://github.com/PierreBeucher/cloudypad/commit/2aa5c62604151f9dbdbeed26852294e073dce70e))
* wolf output 2 times  paired successfully" on pair ([46e82e1](https://github.com/PierreBeucher/cloudypad/commit/46e82e18c2491f84256030911ccf229cd599a480))

## [0.21.0](https://github.com/PierreBeucher/cloudypad/compare/v0.20.0...v0.21.0) (2025-03-21)


### Features

* **auto-stop:** detect download activity and keep instance alive ([71beae1](https://github.com/PierreBeucher/cloudypad/commit/71beae1a9cbe916bc8a1dbf22a6af0b6864d4251))
* ensure controllers, gamepad and other input devices are properly detected ([e181117](https://github.com/PierreBeucher/cloudypad/commit/e181117deb70ae8ba1ee82d7150517680dd2994e))
* show a desktop task bar with Steam and other utils instead of plain desktop icons ([320c4b9](https://github.com/PierreBeucher/cloudypad/commit/320c4b926295ca08bb9c5945084fbf7fdb86967b))


### Bug Fixes

* **cli:** do not run UserConfigDetector in Container as it doesn't match host config ([21fe89c](https://github.com/PierreBeucher/cloudypad/commit/21fe89c65231b7a033d70daa8a5bb2a003b37543))
* generate locale before updating system locale ([bb7dcc1](https://github.com/PierreBeucher/cloudypad/commit/bb7dcc15dc015dbb9d137b9a26b4660e1238bf48))
* prevent X server not starting because of old lock file ([2c6d90c](https://github.com/PierreBeucher/cloudypad/commit/2c6d90c8c0626f56026c0c661491270fd3a88bdb))
* show a single workspace to avoid losing access to windows ([76e8624](https://github.com/PierreBeucher/cloudypad/commit/76e862449ebb4a7ecb6f77c26b0fcdc79ee9d813))

## [0.20.0](https://github.com/PierreBeucher/cloudypad/compare/v0.19.0...v0.20.0) (2025-03-19)


### Features

* adapt resolution while keeping aspect ratio on NVIDIA Tesla GPU maxed at 2560x1600 ([86fd37a](https://github.com/PierreBeucher/cloudypad/commit/86fd37a62a3f282fdce1033cdfb91a28810c256e))
* auto-detect locale and keyboard layout ([7717ea5](https://github.com/PierreBeucher/cloudypad/commit/7717ea5f5b42b92f6f894ac1ec98bee9658215e4))

### Bug Fixes

* Scaleway prompt wrongly stating disk is OS-only ([ca0d6c3](https://github.com/PierreBeucher/cloudypad/commit/ca0d6c3f652bac8d170b12188d7ce5ac38a42f2d))
* **auto-stop:** timeout parameter was ignored and default (15 min) always used ([08bd5c8](https://github.com/PierreBeucher/cloudypad/commit/08bd5c880c5ac4476a36b1e62f2b51b23df102fb))

## [0.19.0](https://github.com/PierreBeucher/cloudypad/compare/v0.18.0...v0.19.0) (2025-03-11)


### Features

* check Scaleway local config ([7b11994](https://github.com/PierreBeucher/cloudypad/commit/7b119946e02a24a8cfed7262cab9e698470fc95f))
* **dummy:** dummy instance are considered stopped by default ([6397608](https://github.com/PierreBeucher/cloudypad/commit/639760816e557889858adc5b28e03c5bea745ea4))
* **dummy:** dummy instance are considered stopped by default ([90f6dd0](https://github.com/PierreBeucher/cloudypad/commit/90f6dd071897c45586448ff51d8bde1f5c4c2d30))
* **dummy:** emulate start/stop time for dummy provider ([f51a663](https://github.com/PierreBeucher/cloudypad/commit/f51a663b60de2b0358a87b5e2dc648f825afc4ce))
* Scaleway provider support ([64e1dd8](https://github.com/PierreBeucher/cloudypad/commit/64e1dd8e3ffbb2aeaf73b9e381d11787d4c373d2))


### Bug Fixes

* screen name not properly detected on Sunshine session startup screen resolution setting ([a7b86f9](https://github.com/PierreBeucher/cloudypad/commit/a7b86f947857bcab6626867b19c49e330bdd54b2))

## [0.18.0](https://github.com/PierreBeucher/cloudypad/compare/v0.17.0...v0.18.0) (2025-03-01)


### Features

* **autostop:** added inactivity detection with automatic machine shutdown ([12931a4](https://github.com/PierreBeucher/cloudypad/commit/12931a450e5ad26322a317df9dd03b3312cb6341))
* **core:** generic Provider registration mechanism ([9741af4](https://github.com/PierreBeucher/cloudypad/commit/9741af4ce87bbf08f370e93b03c847e94d970016))
* dummy provider implementation ([7cc0aef](https://github.com/PierreBeucher/cloudypad/commit/7cc0aef1fdbd630efdeb103abe7252ee26df5090))
* provide pseudo-IPv6 for Mac/Apple devices pairing ([bcfc488](https://github.com/PierreBeucher/cloudypad/commit/bcfc488e27fbd562003b1bcbdbea280743e0c74b))
* **sunshine:** add desktop shortcut for mouse, keyboard and display settings ([fe56524](https://github.com/PierreBeucher/cloudypad/commit/fe565244f6e1218cde98f9e6018db4d672fa50dc))


### Bug Fixes

* ensure install.sh compatibility for sh, bash and zsh ([a5f9125](https://github.com/PierreBeucher/cloudypad/commit/a5f91258a37440f91cc63b9bd10b99d3b4739d7a))
* ensure install.sh compatibility for sh, bash and zsh ([7f60f3f](https://github.com/PierreBeucher/cloudypad/commit/7f60f3fb9023009deb76435746b70519993cb730))
* pass CLOUDYPAD_LOG_LEVEL to container program ([9ace2ce](https://github.com/PierreBeucher/cloudypad/commit/9ace2ce0a94de72aaa3c1ea28645888dacf052f5))
* Sunshine playbook not cleaning Paperspace apt sources file ([e21ecac](https://github.com/PierreBeucher/cloudypad/commit/e21ecac497548f28d41be397e2dc1729b15e36d3))
* **sunshine:** remove _&lt;FPS&gt; suffix in mode name to avoid duplicated mode config ([2fa1286](https://github.com/PierreBeucher/cloudypad/commit/2fa12863c5b56774c9b2c6e4797ece2f0ee707e9))

## [0.17.0](https://github.com/PierreBeucher/cloudypad/compare/v0.16.0...v0.17.0) (2025-02-16)


### Features

* **Steam:** enable Proton 9 compatibility by default ([68c2724](https://github.com/PierreBeucher/cloudypad/commit/68c27249290e0fa87e1a2d1c730815d2bf83422d))
* **Steam:** enable Proton 9 compatibility by default ([3606c9b](https://github.com/PierreBeucher/cloudypad/commit/3606c9bec73623931eb1d894768430104d915ac5))

## [0.16.0](https://github.com/PierreBeucher/cloudypad/compare/v0.15.0...v0.16.0) (2025-02-14)


### Features

* auto detect NVIDIA PCI bus ID ([02aab20](https://github.com/PierreBeucher/cloudypad/commit/02aab20bb9a8daa628f8ea0c3f3df63324d8b6fb))
* automatically resize screen for Sunshine ([17f9796](https://github.com/PierreBeucher/cloudypad/commit/17f97960d846141ae9c424e8dd02ff84f56ffe7e))
* bump Wolf and related images to latest stable ([d224126](https://github.com/PierreBeucher/cloudypad/commit/d224126e61853cd627eb88093cef0196ab471db9))
* enforce no Sunshine support GCP with P4 ([79fb308](https://github.com/PierreBeucher/cloudypad/commit/79fb3081db002f29298d0db2b8bb4692ae462aaf))
* **security:** enforce Sunshine encryption ([b581c1c](https://github.com/PierreBeucher/cloudypad/commit/b581c1cecc5cfe7fe66e776cfffe08710842c679))
* **security:** enforce Sunshine encryption ([f33b8ba](https://github.com/PierreBeucher/cloudypad/commit/f33b8ba58e3aa22af033db01c0cc303acdf8df7b))


### Bug Fixes

* AWS instance type listing failure causing crash ([3e1f203](https://github.com/PierreBeucher/cloudypad/commit/3e1f2031c612ba9b0154443427381959319f13cf))
* SSH error showing [object] in logs ([f1abe26](https://github.com/PierreBeucher/cloudypad/commit/f1abe26090c154131fe5eedb09b4fa9b80afa341))

## [0.15.0](https://github.com/PierreBeucher/cloudypad/compare/v0.14.0...v0.15.0) (2025-02-11)


### Features

* add direct pairSendPin() method ([aeb07e8](https://github.com/PierreBeucher/cloudypad/commit/aeb07e85e5f79d3851f435e17b787fc40844fbe1))
* add getInstanceDetails() manager method ([9347075](https://github.com/PierreBeucher/cloudypad/commit/93470755169b88583cb9ca067ba96df7dd539133))
* allow override of Sunshine image version (tag) and registry ([7b6c6cb](https://github.com/PierreBeucher/cloudypad/commit/7b6c6cbdae74a4ad77f957f8bfe198f72482ffb9))
* get instance status (running, stopped...) via InstanceManager ([8ba1a3d](https://github.com/PierreBeucher/cloudypad/commit/8ba1a3d623e75ef41b5fc156ef03af108f157568))
* **lib:** instance name function and ssh config with details ([e149d77](https://github.com/PierreBeucher/cloudypad/commit/e149d77c4303a7e0ca0422e4987aeedd7bb1b9ab))
* **sunshine:** setup minimal xfce4 environment ([4d5d595](https://github.com/PierreBeucher/cloudypad/commit/4d5d5951534b0c8f32c6f127764a89a88595d316))
* **sunshine:** Steam and exit desktop apps ([d4fa6d5](https://github.com/PierreBeucher/cloudypad/commit/d4fa6d547ed98a49d89ecb029e4afdd572cd7387))
* **sunshine:** Steam App in Sunshine ([467f9aa](https://github.com/PierreBeucher/cloudypad/commit/467f9aa78d25fe4810c01406293a0cc588777f76))


### Bug Fixes

* **gcp:** non-spot instanceTerminationAction is not allowed ([2417703](https://github.com/PierreBeucher/cloudypad/commit/241770301a147e1e4aac8a2a1b81295484d36b51))
* passing "no/False" to spot args should not prompt ([d3b63dc](https://github.com/PierreBeucher/cloudypad/commit/d3b63dc863a3af3b70b63913a0c767f44a176eb5))

## [0.14.0](https://github.com/PierreBeucher/cloudypad/compare/v0.13.0...v0.14.0) (2025-02-02)


### Features

* allow Azure disk type selection (HDD, SSD or Premium SSD) ([f21ccae](https://github.com/PierreBeucher/cloudypad/commit/f21ccaeb228dc8925f834efc635729c8b7de1c3f))
* better error handling ([0b28b96](https://github.com/PierreBeucher/cloudypad/commit/0b28b96d6fa060a108b4427ac851dfe58c0f5cb7))
* Sunshine deployment with Docker container and Ansible ([40d626a](https://github.com/PierreBeucher/cloudypad/commit/40d626a48dac4e604e26f95312ba1b5035737c02))
* support Sunshine streaming server ☀️ ([f3127aa](https://github.com/PierreBeucher/cloudypad/commit/f3127aab672040eb25747c92939281a7cb682667))
* use Azure StandardSSD_LRS by default (better performance) ([3248637](https://github.com/PierreBeucher/cloudypad/commit/3248637de7ba2f99bfaccdeeb03358d14a75e4fd))


### Bug Fixes

* gcp start/stop/restart potentially using wrong instance name ([9179c86](https://github.com/PierreBeucher/cloudypad/commit/9179c86860a89eca5a1be395202e9305f358e84b))

## [0.13.0](https://github.com/PierreBeucher/cloudypad/compare/v0.12.0...v0.13.0) (2025-01-16)


### Features

* check and warn about AWS quota on create ([9e0591a](https://github.com/PierreBeucher/cloudypad/commit/9e0591a2f45c844b7373b55b9d497d77c416e530))
* check and warn about Azure quota on create ([7bd0590](https://github.com/PierreBeucher/cloudypad/commit/7bd0590861276675948df0a4f584430eeccdccd3))
* clear prompt to inform about GPU and quota increase need ([9bf67dc](https://github.com/PierreBeucher/cloudypad/commit/9bf67dc04403b0fca8c3b3879c9af749747963db))
* setup cost alerts for AWS on create/update ([7da54fb](https://github.com/PierreBeucher/cloudypad/commit/7da54fb335bec3135bd071fac37e9300d2505597))
* setup cost alerts for Azure on create/update ([4e7b785](https://github.com/PierreBeucher/cloudypad/commit/4e7b785703f4b0dbc23f4a11dff7288e2d5f18ec))
* setup cost alerts for Google Cloud Platform (GCP) on create/update ([12f0982](https://github.com/PierreBeucher/cloudypad/commit/12f0982f9b28e9423803c6123dc5d44f9affb96a))

## [0.12.0](https://github.com/PierreBeucher/cloudypad/compare/v0.11.0...v0.12.0) (2025-01-07)


### Features

* prettier Pulumi outputs with colors and without unnecessary newlines ([abcf356](https://github.com/PierreBeucher/cloudypad/commit/abcf356325c3bda6406dcd7ff87fc2a20e9b973a))


### Bug Fixes

* typo in install script shebang ([85c76c5](https://github.com/PierreBeucher/cloudypad/commit/85c76c5b498a236480292c37e73e74de7b55a159))

## [0.11.0](https://github.com/PierreBeucher/cloudypad/compare/v0.10.0...v0.11.0) (2025-01-05)


### Features

* cloudypad create --skip-pairing option ([139382b](https://github.com/PierreBeucher/cloudypad/commit/139382bd5d66810440a6c934a80eb720bf42f6f9))
* default to auto-pairing after create ([c394325](https://github.com/PierreBeucher/cloudypad/commit/c39432582bf130ece769605cb18af5f9e7626b1b))
* global CLI config persisted on disk ([9dbe35b](https://github.com/PierreBeucher/cloudypad/commit/9dbe35b21023bd3e3faaebec4d919627950c1bcd))
* **paperspace:** implement start/stop/restart --wait flag ([e9667ed](https://github.com/PierreBeucher/cloudypad/commit/e9667ed9635be556dc6dae1ae6be39c1c4b221bf))


### Bug Fixes

* listing empty instances directory should not cause error ([90da7be](https://github.com/PierreBeucher/cloudypad/commit/90da7be811369fa15ead4537660300f8406e6fee))
* more robust logic to identify GCC version used to compile kernel ([7ae9e50](https://github.com/PierreBeucher/cloudypad/commit/7ae9e503492d6056fddd26787e34cbfd3b3dc4f9))
* **paperspace:** broken Paperspace apt repo GPG key ([dad83cb](https://github.com/PierreBeucher/cloudypad/commit/dad83cb6ffdf54898a1ded52bed89ee93c84b2d3))
* **paperspace:** do not create another instance on provision if one already exists ([352c643](https://github.com/PierreBeucher/cloudypad/commit/352c6436d1cb340f29ddad32057d8cc698e0bb56))

## [0.10.0](https://github.com/PierreBeucher/cloudypad/compare/v0.9.0...v0.10.0) (2025-01-02)


### Features

* add 'cloudypad update' command to update some instance configurations (eg. disk size or instance type) ([cbd2f4e](https://github.com/PierreBeucher/cloudypad/commit/cbd2f4e8cd5980df30963ccaef91ecae66627d16))
* cloudypad start/stop/restart --wait and --timeout flags ([17d93a6](https://github.com/PierreBeucher/cloudypad/commit/17d93a6debf95334432b67dffece5885e6a00dde))
* destroy command --yes flag for auto approval ([c202e67](https://github.com/PierreBeucher/cloudypad/commit/c202e67d3646f326df823e6d92d847c2d648ecea))


### Bug Fixes

* Azure instance with dynamic IP creation failure ([6e6cc2f](https://github.com/PierreBeucher/cloudypad/commit/6e6cc2ffc64cd2bd77c85ba7e8d92362fa82e679))
* prompt for existing instance as soon as instance name is known ([81137aa](https://github.com/PierreBeucher/cloudypad/commit/81137aaf269a155a0f00b539b5e59cf54cf7a649))

## [0.9.0](https://github.com/PierreBeucher/cloudypad/compare/v0.8.0...v0.9.0) (2024-12-27)


### Features

* change interface and underlying state format ([c4688d8](https://github.com/PierreBeucher/cloudypad/commit/c4688d85ef787ee520688b02c5cf1077c8694e74))
* ensure instance name is kebab case on creation ([f9ad37c](https://github.com/PierreBeucher/cloudypad/commit/f9ad37c0331ff692f692fb09b452981ff59603db))
* faster initial startup by pulling known container images on configuration ([98428e2](https://github.com/PierreBeucher/cloudypad/commit/98428e22d48f2e96aae65504e7c2d0f8d6e9224f))
* **license:** switch from GPL to AGPL ([82cef52](https://github.com/PierreBeucher/cloudypad/commit/82cef52a110943f8df3659076a4a3e8b6d4722b0))
* more reproduciblity and stability by locking Wolf apps container images ([070a24e](https://github.com/PierreBeucher/cloudypad/commit/070a24ec56bf3eb7a782ed16e0182732a862b188))
* template Wolf config with known apps and instance name ([ec48e72](https://github.com/PierreBeucher/cloudypad/commit/ec48e72a297c5eaf38078cdbb489de9bc195d76f))
* use Spot instance by default ([a87c98d](https://github.com/PierreBeucher/cloudypad/commit/a87c98dddd3eb55e47e082b3d8968d00e3db3a86))
* use Spot instance by default ([307fd73](https://github.com/PierreBeucher/cloudypad/commit/307fd73684cb6998926da9b1441b42d7fd94222d))
* Zod schema validation for persisted state ([61c01fd](https://github.com/PierreBeucher/cloudypad/commit/61c01fd57e2a98c53010ddd91842e79dd7e619fb))


### Bug Fixes

* install Pulumi ARM64 instead of X64 variant for ARM64 container … ([ca8e753](https://github.com/PierreBeucher/cloudypad/commit/ca8e753a81a50d208860b21cdfea8bbc93a22d30))
* install Pulumi ARM64 instead of X64 variant for ARM64 container image ([e0f25af](https://github.com/PierreBeucher/cloudypad/commit/e0f25af8aebaf40dd94d1dbe7061cbf30b9f0823))
* **install:** use bash, fix missing existing install variable and check Docker installation ([4c74516](https://github.com/PierreBeucher/cloudypad/commit/4c7451642f349deb9b241b2ad52f596e92458ef6))

## [0.8.0](https://github.com/PierreBeucher/cloudypad/compare/v0.7.0...v0.8.0) (2024-11-30)


### Features

* bump driver version and more flexible install method ([ea8a1bf](https://github.com/PierreBeucher/cloudypad/commit/ea8a1bf899005d09419a99769f4d66e4c69affc1))
* **doc:** rewrote doc as mdbook ([c97de91](https://github.com/PierreBeucher/cloudypad/commit/c97de911db95437f1af168dc556a78ea46abdcc3))
* more automated Moonlight pairing ([6f8029e](https://github.com/PierreBeucher/cloudypad/commit/6f8029ea48a1c056f6781754a33cf0144b37b97b))


### Bug Fixes

* Azure start should use start() and not restart() function ([7fc38aa](https://github.com/PierreBeucher/cloudypad/commit/7fc38aacc27b263c62b3af52ee4e740d3b7ac2e5))
* fixed Cloud image to avoid reproducibility issues ([0cca532](https://github.com/PierreBeucher/cloudypad/commit/0cca53243e462c5e4c1d41a8e513d1973421eec3))
* post reboot delay to avoid too-early continue ([a257d28](https://github.com/PierreBeucher/cloudypad/commit/a257d28410145c4b8b2512b0b91f473e0817a853))
* prompt error on missing AWS region in user's config ([4e1eaab](https://github.com/PierreBeucher/cloudypad/commit/4e1eaab413e4625a1698783a543ed79399ef7206))

## [0.7.0](https://github.com/PierreBeucher/cloudypad/compare/v0.6.0...v0.7.0) (2024-09-15)


### Features

* detect missing Docker on install ([1c68dc1](https://github.com/PierreBeucher/cloudypad/commit/1c68dc1e48b9abef87538f3de42fd9b650cfe8a1))
* log level environment variable CLOUDYPAD_LOG_LEVEL ([59699fb](https://github.com/PierreBeucher/cloudypad/commit/59699fbb0969201003e9a971d1a95cc53e649d99))
* more explicit pricing examples - show GPU/CPU/RAM, Spot usage and use closer to reality setups ([3b7bace](https://github.com/PierreBeucher/cloudypad/commit/3b7bacebdcd9d8f08697648463eb3184ca1c4b57))
* option to use AWS Spot instances ([532d1b7](https://github.com/PierreBeucher/cloudypad/commit/532d1b71219b4c9effcf05215058bf54a64b165e))
* option to use Azure Spot instances ([63847cc](https://github.com/PierreBeucher/cloudypad/commit/63847cc7b254dfcfdce43f01c94ba0b6d0f0b847))
* option to use Google Cloud Spot instances ([94480f1](https://github.com/PierreBeucher/cloudypad/commit/94480f1c0eea429a394747f425e99b665a6d97ff))


### Bug Fixes

* **install.sh:** read from /dev/tty to ensure piped script content works as expected ([3e25fae](https://github.com/PierreBeucher/cloudypad/commit/3e25faec14c63838c78df1b7d16994745b74c550))
* **install.sh:** use sh instead of bash to install in user default shell ([571c6f5](https://github.com/PierreBeucher/cloudypad/commit/571c6f5dcb87012b743e7a496b6ce9f46bb65ff5))
* provision() optional argument ([8a25c71](https://github.com/PierreBeucher/cloudypad/commit/8a25c711cd8d21a893b537cb7ff94f9c4765b663))

## [0.6.0](https://github.com/PierreBeucher/cloudypad/compare/v0.5.0...v0.6.0) (2024-09-07)


### Features

* upgrade Wolf to latest stable version ([fabfaba](https://github.com/PierreBeucher/cloudypad/commit/fabfaba3535ba9921703af6af6df8cd81bae778b))


### Bug Fixes

* ensure NVIDIA driver install reproducibility ([b1ae764](https://github.com/PierreBeucher/cloudypad/commit/b1ae764f76cd3e2cf2eca48c90ddfc259efeb62d))

## [0.5.0](https://github.com/PierreBeucher/cloudypad/compare/v0.4.0...v0.5.0) (2024-08-09)


### Features

* Azure Cloud provider support ([057c1db](https://github.com/PierreBeucher/cloudypad/commit/057c1dbe0b58f567839d7872e6c2a97fb0805ac2))
* Google Cloud Platform (GCP) provider support ([4688933](https://github.com/PierreBeucher/cloudypad/commit/4688933146f42079e910f6b2a5af10ed0ad246e3))


### Bug Fixes

* noop generic create command ([e58594b](https://github.com/PierreBeucher/cloudypad/commit/e58594baeb1adc0d219dc0cb773d7ba60c689077))
* properly expand parameters in script ([5431456](https://github.com/PierreBeucher/cloudypad/commit/54314569d051a64284b4353ec24a1c5f942f8e1a))
* properly pass PAPERSPACE_API_KEY env var to internal container ([06b1dc9](https://github.com/PierreBeucher/cloudypad/commit/06b1dc9db7dcabf0fca05ef9ae62d9b1ea3e40ff))

## [0.4.0](https://github.com/PierreBeucher/cloudypad/compare/v0.3.0...v0.4.0) (2024-08-04)


### Features

* cloudypad list output format (json, plain) ([61800c6](https://github.com/PierreBeucher/cloudypad/commit/61800c6afff7462394fe6a1d484bd3ee046c98d5))

## [0.3.0](https://github.com/PierreBeucher/cloudypad/compare/v0.2.0...v0.3.0) (2024-08-04)


### Features

* delete Paperspace static public IP on destroy ([f2f51b9](https://github.com/PierreBeucher/cloudypad/commit/f2f51b9cbc1de357913343838729c3936b2dd0c2))


### Bug Fixes

* don't show empty "source" prompt if no startup file found on install ([a76296b](https://github.com/PierreBeucher/cloudypad/commit/a76296b31346881a8908b1d572ec29467fbcf3f1))
* Paperspace API key not passed in state properly ([95c8308](https://github.com/PierreBeucher/cloudypad/commit/95c8308cae6a48ffcfef41077bc337d69b78dc77))

## [0.2.0](https://github.com/PierreBeucher/cloudypad/compare/v0.1.1...v0.2.0) (2024-08-02)


### Features

* --overwrite-existing flag on instance creation ([eee5e32](https://github.com/PierreBeucher/cloudypad/commit/eee5e32aa4779004072ecb3f292bb8b0febbd3e8))
* allow installation of specific branch or commit ([be65d24](https://github.com/PierreBeucher/cloudypad/commit/be65d244fe18ddf835fba01dc2a4406102a2b91c))
* auto-approve flag for creation ([fa66d80](https://github.com/PierreBeucher/cloudypad/commit/fa66d8009081c98c6807aa06b73dd305273b7e1b))
* cloudypad create &lt;provider&gt; subcommand ([6deb856](https://github.com/PierreBeucher/cloudypad/commit/6deb85616cb88c3839756bcd2b1529e4553d5f58))
* ignore host key checking on initial creation ([acb981a](https://github.com/PierreBeucher/cloudypad/commit/acb981a598c5aa667b6746a0a897efbae8362e9f))
* pass-through AWS env variables ([5f94dbe](https://github.com/PierreBeucher/cloudypad/commit/5f94dbe2d9a4b45b78ba6d70c72e50a0bb0acadc))


### Bug Fixes

* allow run as root ([0a0e07f](https://github.com/PierreBeucher/cloudypad/commit/0a0e07fb357ee13227db7ebc3141951d4f70e154))
* automatically cancel Pulumi stack before up ([e72cfdb](https://github.com/PierreBeucher/cloudypad/commit/e72cfdb4ef031cbfd44dce593304817db2e8aaa9))
* ignored AWS region in Pulumi config ([13a2de5](https://github.com/PierreBeucher/cloudypad/commit/13a2de5d4e593ad9576085d4634bc15d7a88b931))
* simple docker build (no buildx) ([72c5d8f](https://github.com/PierreBeucher/cloudypad/commit/72c5d8fb5a2204e4881964de2e96cdf6c9b2a3ff))
