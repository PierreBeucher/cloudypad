#!/usr/bin/env bash

#
# Cloudy Pad App Installer
# Install optional applications on-demand
#

show_menu() {
    zenity --list \
        --title="Cloudy Pad App Installer" \
        --text="Select an application to install:" \
        --column="App" --column="Description" --column="Status" \
        --width=500 --height=400 \
        "Prism Launcher" "Minecraft launcher" "$(get_status prismlauncher)"
}

get_status() {
    case "$1" in
        prismlauncher)
            if [ -x "/opt/prismlauncher/PrismLauncher.AppImage" ]; then
                echo "Installed"
            else
                echo "Not installed"
            fi
            ;;
    esac
}

install_app() {
    case "$1" in
        "Prism Launcher")
            if [ -x "/opt/prismlauncher/PrismLauncher.AppImage" ]; then
                zenity --info --text="Prism Launcher is already installed." --title="App Installer"
            else
                x-terminal-emulator -e /cloudy/bin/install-prismlauncher.sh
            fi
            ;;
    esac
}

while true; do
    choice=$(show_menu)
    
    if [ -z "$choice" ]; then
        exit 0
    fi
    
    install_app "$choice"
done
