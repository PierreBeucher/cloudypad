#!/bin/sh

set -e

#
# Create a release from current commit.
#
# Gotcha:
# - Must be run after release-please PR has been merged.
# - If script fails, it can be restarted safely and should be reasonably idempotent
#
# 

if [ -z ${GITHUB_TOKEN+x} ]; then 
    echo "GITHUB_TOKEN variable must be set (with read/write permissions on content and pull requests)"
    exit 1
fi

echo "Current commit message:"
echo "---"
git log -1 --pretty=%B | cat
echo "---"
echo

echo "Create release for from current commit?"
read -p "'yes' to continue: " answer

case ${answer:-N} in
    yes ) echo "🚀";;
    * ) echo "Type 'yes' to continue"; exit 1;;
esac

# Create draft release
npx release-please github-release --repo-url https://github.com/PierreBeucher/cloudypad --token=${GITHUB_TOKEN} --draft

# current_release=$(gh release list -L 1 | cut -d$'\t' -f1)

# # make sure release is draft (normally done with release-please --draft)
# # gh release edit "${current_release}" --draft

# # Finalize it !
# gh release edit "${current_release}" --latest --draft=false