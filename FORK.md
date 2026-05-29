# Fork notes (gabbelitoV2/cloudypad)

This is a personal fork of [PierreBeucher/cloudypad](https://github.com/PierreBeucher/cloudypad)
with extra features (Sunshine **App Installer** + **Prism Launcher / Minecraft**),
kept up to date with the upstream creator.

## How it's organized

- **`origin`** = your fork (`github.com/gabbelitoV2/cloudypad`)
- **`upstream`** = the real creator (`github.com/PierreBeucher/cloudypad`)
- **`master`** = your version: latest upstream + your feature commits + one
  "fork config" commit on top.

`master` contains two layers on top of upstream:

1. **Feature commits** — App Installer / Prism Launcher. These are clean and can
   be contributed back to upstream (see below).
2. **Fork config commit** — repoints the container images to your registry so
   deployments use *your* customized image. **This stays in your fork only — do
   not include it in PRs to upstream.**

### What the fork config commit changes

Only image/release references (not docs, license or changelog):

| File | Change |
|------|--------|
| `src/core/const.ts` | Sunshine image registry → `ghcr.io/gabbelitov2/cloudypad` |
| `ansible/roles/sunshine/defaults/main.yml` | `sunshine_image_repo` → your ghcr |
| `Taskfile.yml` | core + Sunshine build registries → your ghcr |
| `cloudypad.sh` | core image the CLI runs as → your ghcr |
| `install.sh` | fetches `cloudypad.sh` from your fork |
| `flake.nix` | Nix package fetches `cloudypad.sh` from your fork (+ matching hash) |
| `hack/release-create.sh` | release-please `--repo-url` → your fork |
| `.github/workflows/test-unit.yml` | install-test curls `install.sh` from your fork |

`flake.nix`'s `novops` input still points to `PierreBeucher/novops` — that's a
separate tool, not the Cloudy Pad repo, so it must stay. `flake.lock` is left
untouched (its `PierreBeucher` entries are the locked novops dependency).
Cosmetic "file an issue / leave a star" links across `src/` and the docs still
point upstream on purpose.

> Note: `.github/workflows/release.yml` still uses `runs-on: self-hosted`
> (upstream's build server). This fork publishes images **locally** instead, via
> `hack/fork-publish-images.sh`, so that workflow is left untouched.

## Update from the creator (get the latest upstream version)

```bash
./hack/fork-update-from-upstream.sh        # rebases master onto upstream/master
git push --force-with-lease origin master  # publish to your fork
./hack/fork-publish-images.sh              # rebuild + push your images
```

## Publish your images

`cloudypad` pulls your images from `ghcr.io/gabbelitov2`, so after any change to
the Sunshine container or the CLI, rebuild and push:

```bash
./hack/fork-publish-images.sh              # uses version from package.json
```

Requires Nix + Docker buildx and a ghcr login with `write:packages`. Make the
packages public at <https://github.com/gabbelitoV2?tab=packages> so instances
can pull them.

## Contribute a feature back to the real Cloudy Pad

Don't PR `master` (it carries the fork config). Instead, branch from clean
upstream and cherry-pick only the feature commit(s):

```bash
git fetch upstream
git checkout -b my-feature upstream/master
git cherry-pick <feature-commit-sha>      # e.g. the Prism Launcher commits, NOT the fork config commit
git push origin my-feature
gh pr create --repo PierreBeucher/cloudypad --base master --head gabbelitoV2:my-feature
```
