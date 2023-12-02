{ lib, pkgs, config, ... }: {
    
    # French layout
    services.xserver = {
        layout = "fr";
        xkbVariant = "azerty";
    };
    console.keyMap = "fr";
    time.timeZone = "Europe/Paris";

    programs.steam.enable = true;
}