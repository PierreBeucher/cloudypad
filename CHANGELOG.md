# Changelog

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
