# Changelog

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
