# Changelog

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
