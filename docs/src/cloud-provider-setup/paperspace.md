# Paperspace provider setup

_ℹ️ Cloudy Pad Paperspace provider is deprecated. No new feature will be added and support will be dropped in a later version._

If you don't already have a Paperspace account, [create an account](https://console.paperspace.com/signup).

If you haven't already setup an SSH key in your profile:

- If needed, generate an SSH key with `ssh-keygen -t ed25519 -a 100`
- Log into your account and go to _Your account > SSH Keys > Add new SSH key_ to add your key. ([see doc for details](https://docs.digitalocean.com/products/paperspace/accounts-and-teams/add-ssh-keys/))

You'll need an API key to create your instance:

- Go to _Team settings > API Keys > Add_ ([see doc for details](https://docs.digitalocean.com/reference/paperspace/api-keys/))

You're good to go ! Create your instance with

```sh
cloudypad create
```