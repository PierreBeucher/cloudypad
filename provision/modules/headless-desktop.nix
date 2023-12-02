{ lib, pkgs, config, ... }: {

    networking.networkmanager.enable = true;

    services.openssh.settings.PasswordAuthentication = false;

    environment.systemPackages = with pkgs; [
        xorg.xrandr
    ];

    # X and audio
    sound.enable = true;
    hardware.pulseaudio.enable = true;
    security.rtkit.enable = true;
    
    services.xserver = {
        enable = true;
        
        # Using gdm and gnome
        # lightdm failed to start with autologin, probably linked to X auth and Gnome service conflict
        # X auth was not ready when Gnome session started, can be seen with journalctl _UID=$(id -u sunshine) -b
        # Maybe another combination of displayManager / desktopManager works
        displayManager.gdm.enable = true;
        desktopManager.gnome.enable = true;

        # autologin
        displayManager.autoLogin.enable = true;
        displayManager.autoLogin.user = "sunshine";
        displayManager.defaultSession = "gnome";
    };

    # Gnome and amazon-image conflict, enforce value
    services.udisks2.enable = lib.mkForce false;

    users.users.sunshine = {
        isNormalUser  = true;
        home  = "/home/sunshine";
        description  = "Sunshine Server";
        extraGroups  = [ "wheel" "networkmanager" "input" "video" "sound"];
        initialPassword  = "sunshine";
    };

    security.sudo.extraRules = [
        {  
            users = [ "sunshine" ];
            commands = [
                { 
                    command = "ALL" ;
                    options= [ "NOPASSWD" ];
                }
            ];
        }
    ];
}