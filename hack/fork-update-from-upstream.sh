#!/usr/bin/env bash

#
# Update this fork from upstream (the real creator, PierreBeucher/cloudypad),
# keeping our own changes on top.
#
# It fetches upstream and rebases your branch onto upstream/master, so your
# commits (Prism Launcher / App Installer + fork config) are replayed on top of
# the latest upstream version.
#
# Usage:
#   ./hack/fork-update-from-upstream.sh           # updates master
#   ./hack/fork-update-from-upstream.sh add-prismlauncher
#

set -euo pipefail

UPSTREAM_REMOTE="upstream"
UPSTREAM_URL="https://github.com/PierreBeucher/cloudypad.git"
BRANCH="${1:-master}"

# Ensure the upstream remote exists
if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
  echo "Adding '$UPSTREAM_REMOTE' remote -> $UPSTREAM_URL"
  git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi

echo "Fetching $UPSTREAM_REMOTE (the creator's repo)..."
git fetch "$UPSTREAM_REMOTE" --tags

echo "Rebasing '$BRANCH' onto $UPSTREAM_REMOTE/master..."
git checkout "$BRANCH"
git rebase "$UPSTREAM_REMOTE/master"

cat <<EOF

✅ Done. '$BRANCH' is now the latest upstream version with your changes on top.

If there were conflicts, Git paused — fix the files, 'git add' them, then
'git rebase --continue' (or './hack/fork-update-from-upstream.sh' again).

Review, then publish to your fork:

  git push --force-with-lease origin $BRANCH

Then rebuild + publish your images so deployments use the new base:

  ./hack/fork-publish-images.sh

EOF
