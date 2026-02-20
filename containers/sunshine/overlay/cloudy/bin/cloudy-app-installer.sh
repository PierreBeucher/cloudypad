#!/usr/bin/env bash

#
# Cloudy Pad App Installer
# Install optional applications on-demand
#

INSTALL_SCRIPTS_DIR="/cloudy/bin"

show_menu() {
    zenity --list \
        --title="Cloudy Pad App Installer" \
        --text="Select an application to install:" \
        --column="App" --column="Description" --column="Status" \
        --width=500 --height=400 \
        --ok-label="Install" \
        --cancel-label="Close" \
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
            install_prismlauncher
            ;;
    esac
}

install_prismlauncher() {
    if [ -x "/opt/prismlauncher/PrismLauncher.AppImage" ]; then
        zenity --question \
            --title="Prism Launcher" \
            --text="Prism Launcher is already installed.\n\nDo you want to launch it?" \
            --ok-label="Launch" \
            --cancel-label="Back"
        if [ $? -eq 0 ]; then
            prismlauncher-start.sh &
            exit 0
        fi
    else
        "${INSTALL_SCRIPTS_DIR}/install-prismlauncher.sh" | zenity --progress \
            --title="Installing Prism Launcher" \
            --text="Starting installation..." \
            --percentage=0 \
            --auto-close \
            --width=400
        
        if [ -x "/opt/prismlauncher/PrismLauncher.AppImage" ]; then
            choice=$(zenity --list \
                --title="Installation Complete" \
                --text="Prism Launcher installed successfully!" \
                --column="Action" --column="Description" \
                --width=500 --height=300 \
                "Launch now" "Start Prism Launcher" \
                "Show in Moonlight" "Restart session to update Moonlight app list" \
                "Close" "Continue using desktop")
            
            case "$choice" in
                "Launch now")
                    prismlauncher-start.sh &
                    ;;
                "Show in Moonlight")
                    pkill -TERM sunshine
                    ;;
            esac
            exit 0
        else
            zenity --error \
                --title="Installation Failed" \
                --text="Installation failed.\n\nCheck /tmp/prismlauncher-install.log for details."
        fi
    fi
}

while true; do
    choice=$(show_menu)
    
    if [ -z "$choice" ]; then
        exit 0
    fi
    
    install_app "$choice"
done
