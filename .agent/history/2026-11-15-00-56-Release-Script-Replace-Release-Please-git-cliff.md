# Replace release-please with an idempotent release script and git-cliff

Challenge and refine the release plan, pick a release notes tool, then implement a fully automated, idempotent release script working only on a `release-X.Y.Z` branch and ending with an unmerged PR to master.

## Initial iteration

> Review '/home/pbeucher/git/cloudypad/core/release-plan.md' and challenge it. Goal: get rid of release please and do our own, simple release script.
>
> One hole remains though: how to generate release notes. I need a simple tool to read history from previous release, consider important commits (feat, fix, etc.), ignore dev: and chore: and such - to update the CHANGELOG.md (or a similar file, we can migrate). FInd me a proper tooling or method.

### Code changes

None, review only.

### Issues encountered

- Found by reading `README`/docs: users install with `curl .../master/install.sh`, and `install.sh` pins `v$V` while `cloudypad.sh` pulls image `:$V`. **Master is the go-live point**, so stamping master before images exist breaks every fresh install for the whole Release CI duration (up to 60 min), not "minutes" as the plan claimed. This drove the whole process redesign.
- Commit history audit (`git log --format=%s v0.45.2..HEAD` grouped by prefix): 14 feat, 8 fix, but many non-conventional prefixes (`sunshine:`, `scaleway:`, `plasma:`, `wip:`, `ai:`). Existing CHANGELOG also has duplicate entries (merge commit + original commit parsed by release-please).
- Release notes tool comparison: git-cliff chosen (single binary in nixpkgs, `--unreleased --tag`, `--bumped-version`, configurable parsers). Rejected: `gh release create --generate-notes` (PR-based, many commits are pushed directly to master), conventional-changelog (npm dep, less flexible), cocogitto (full release manager, overlaps the script), git-chglog (stale), plain `git log` (reimplementing parsing/grouping).
- `gh api repos/.../branches/master` → `protected: false`: direct push possible (later irrelevant as user wants PR-only).

## Iteration 2

> 1. but we're gonna do the release on a release branch, not master, and merge in master only when it's done. Won't that work?
> 2. Yes, script must actually be idempotent - very important
> 3. Sure
> 6. Yes to all
>
> Problems:
> - skip the changelog duplicate. I'll hand edit if needed
> - non conventional commits can be skipped
>
> Ok for cliff. Now affine our plan based on my answers

### Code changes

Rewrote `release-plan.md` around a release branch and an idempotency model (remote-state-driven resume table).

### Issues encountered

- Release branch works, but only if merged with a **merge commit** (or fast-forward): squash/rebase would orphan tag `v$V` from master history, and next git-cliff run would not find the previous release boundary and re-list commits.
- Checked `test-unit.yml`/`test-integ.yml` triggers: only `push: master` and `pull_request`, so pushing a release branch triggers nothing.

## Iteration 3

> What I do want as process:
> - Create (or re-uese existing) branch named "release-xxx"
> - All the work happens on this branch: update versions, changelog, tag creation etc.
> - NO AUTOMATIC MASTER COMMIT OR PUSH. EVERYTHING ON BRANCH (including GH release creation). The release script eventually creates a PR to merge in master, but it DOES NOT MERGE IT. That's the final human action
>
> Is this taken into account? Update plan as needed

### Code changes

Plan rewritten: no master writes, GitHub release published before merge, final step opens a PR, `--abort` allowed until PR is merged, preflight checks previous tag is reachable from master.

### Issues encountered

- Previous plan version still pushed to master directly and deleted the branch: not compatible. Side effects surfaced: GitHub "latest" shows `v$V` before master serves it; merge method must be merge commit.

## Iteration 4

> side effects:
> - acceptable to have rlease "latest" before merge. it on't impact install.sh right?
> - Yes for PR.

### Code changes

None.

### Issues encountered

- Verified by grep: `install.sh` uses hardcoded `DEFAULT_CLOUDYPAD_SCRIPT_REF`, `cloudypad.sh` uses `CLOUDYPAD_VERSION` image tag, release builds push no `latest` image tag, no `releases/latest` usage for Cloudy Pad. GitHub "latest" has no install impact.

## Iteration 5 - 9 (planning refinements)

> good. Anything else before we implement? (no code, just asking)

> 1. simple shell or bash 2. Sure 3. Fne, dry run is limited that's ok. No pre-release. 4. Wat's thier to edit in the first time.? 5. Adapt docs 6. Skip tests and other test jobs on release branch. We only need to build. 7. nothing to say here 8. sure — Update plan acocrdingly. Anything else?

> ah yes, so release CI does almost nothing (or nothing?), and only TAG CI does build our release image. RIght? Sure, add flake has; Anything else?

> [smoke test question] Explain

> I see. Yes do proper check and fail if it fails. Anything else? (still planning, no action)

> 1. yes skip 2. no. 3. sure 4. sure 5. Unrelated to us. Ignore this. — Is your plan good now?

> Neither A nor B, the output is just used, end of story. No prompt, no confirlmation here - the release should run fully automated

### Code changes

Plan refined: Bash script, version resolution (arg > in-progress release > git-cliff bump), plain `X.Y.Z` only, all CI jobs skipped on `release-*` PRs, flake hash check against file served for the tag, published image `--version` check, leftover local tag handling, CI run selection by commit SHA with `timeout`, fully automated (no prompt anywhere).

### Issues encountered

- Version on resume: without explicit version, `git cliff --bumped-version` would compute the *next* version once `v$V` exists, starting a second release. Fixed by resolving the in-progress release first.
- Release PR CI analysis (`Taskfile.yml` build tasks): PR `build`/`build-sunshine` only build amd64 images with `--load` and write a `release-X-cache` registry cache; no image push (dev push is master-only). Redundant with tag-triggered Release workflow → skip all jobs.
- Existing bug: `test-unit.yml` skip conditions used `startsWith(github.head_ref, 'release/')` while branches are `release-*`: never applied.
- Existing bug: `test-container-smoke-test` version check ends with `|| echo ...` and unquoted `$(...)`: never fails on mismatch (nor on `[` syntax error).
- Flake hash verification trap: `nix build .#` would pass trivially because the stamp step adds a store path with the same fixed-output hash; must download the file actually served by `raw.githubusercontent.com` for the tag and hash it.
- Rehearsal: dry run only covers stamp step. Prerelease versions were proposed as test vehicle, rejected by user.

## Iteration 10 - Implementation

> Goood ! Let's now implement this: CODE ONLY, no run, no action appart from simple coding (and not commit either)

### Code changes

Added `cliff.toml`, `git-cliff` in flake dev shell, rewrote `hack/release-create.sh` (6 idempotent steps + `--abort`), Taskfile release task with `CLI_ARGS` and fixed smoke test, `v*` tag trigger and explicit permissions on Release workflow, release-PR job skips, rewritten maintenance doc Release section, removed release-please config files. Nothing run or tested.

### Issues encountered

- Bash pitfalls handled in script design:
  - `set -e` is not inherited by command substitutions: added `shopt -s inherit_errexit` since many helpers return values via `$(...)`.
  - `pipefail` + early-exiting readers (`grep -q`, `awk ... exit`) can fail with SIGPIPE on the writer (`git show`): used `grep -c` and flag-based awk that consumes all input.
  - Computing the flake hash inline in an argument (`"$(nix_flat_hash ...)"`) would not abort on failure: assigned to a variable first.
- Used `nix-hash --flat --base32` instead of `nix-prefetch-url file://` (same Nix base32 flat hash, no store side effect).
- Remote tag commit detection via `git ls-remote` with both `refs/tags/vX` and `refs/tags/vX^{}` patterns to get the peeled commit of annotated tags.
- `git fetch --prune --force --tags`: `--tags` with `--prune` does not prune local tags, so leftover local tags from interrupted runs are kept and handled explicitly; `--force` makes remote tags win.
- In-progress detection must ignore stale merged release branches: only versions greater than the latest tag merged in master count.
- Closed (not merged) release PRs are ignored instead of failing, otherwise `--abort` (which closes the PR) would block re-releasing the same version.
- `novops load -e release` only prints exports: docs/error message use `source <(novops load -e release)`.
- `git rm` staged the release-please deletions; unstaged with `git reset` to respect "no commit/no action" (files remain deleted in working tree).
