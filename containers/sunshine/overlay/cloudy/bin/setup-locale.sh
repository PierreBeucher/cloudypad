#!/usr/bin/env bash

#
# Setup locale according to user locale
# passed as CLOUDYPAD_LOCALE environment variable
# 

echo "Setting locale to CLOUDYPAD_LOCALE='$CLOUDYPAD_LOCALE' (if not set, default en_US.UTF-8)"

current_locale="$(locale | grep ^LANG= | awk -F '=' '{ print $2}')"
desired_locale=${CLOUDYPAD_LOCALE:-"en_US.UTF-8"}

echo "Current locale: '$current_locale'"
echo "Desired locale: '$desired_locale'"

if [ -n "$desired_locale" ]; then
    if [ "$desired_locale" != "$current_locale" ]; then
        echo "Setting locale to $desired_locale"

        locale-gen "$desired_locale"
        update-locale LANG="$desired_locale"
        export LANG="$desired_locale"
        export LANGUAGE="${desired_locale}"
        export LC_ALL="${desired_locale}"

        echo "Locale set to '$desired_locale'"
    else
        echo "Desired locale '$desired_locale' is already set, not changing locale"
    fi
else
    echo "No desired locale set, not changing locale"
fi

