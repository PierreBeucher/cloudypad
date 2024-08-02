# Development guide

## Release

1. Set `export GITHUB_TOKEN=xxx` variable
2. Make sure all versions are updated in various files:
   ```sh
   task release-update-version
   ```
   And push changes to `master`
   _Note: this may be automated using release-please updaters_
3. Create Release Please PR and merge it:
    ```sh 
    task release-pr
    ```
4. Checkout release commit and build+publish container image:
    ```sh
    release-build-image
    ```
5. Create Release tag:
    ```sh
    task release-tag
    ```
6. Update `flake.nix` with latest release:
   ```sh
   task release-flake-update
   ```