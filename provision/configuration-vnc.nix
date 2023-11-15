{ modulesPath, pkgs, lib, config, ... }: {
    imports = [ 
        "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
    ];
    
    system.stateVersion = "23.05";

    nixpkgs.config.allowUnfree = true; 

    networking.firewall = {
      allowedTCPPortRanges = [ { from = 0; to = 65535; } ];
      allowedUDPPortRanges = [ { from = 0; to = 65535; } ];
    };

    networking.networkmanager.enable = true;

    # Configure keymap in X11
    services.xserver = {
        layout = "fr";
        xkbVariant = "azerty";
    };

    # Configure console keymap
    console.keyMap = "fr";

    nixpkgs.config.permittedInsecurePackages = [
        "tightvnc-1.3.10"
    ];

    # OS packages
    environment.systemPackages = with pkgs; [
        # tigervnc
        # tightvnc
        # xorg.xinit

        turbovnc
    ];

    # X and audio
    sound.enable = true;
    hardware.pulseaudio.enable = true;
    security.rtkit.enable = true;

    services.xserver = {
        enable = true;
        videoDrivers = ["nvidia"];
        
        displayManager.lightdm.enable = true; # already a default ?
        desktopManager.gnome.enable = true;
    };

    # Force stop udisks2 (conflict with Gnome)
    services.udisks2.enable = lib.mkForce false;

     users.users.vnc = {
        isNormalUser  = true;
        home  = "/home/vnc";
        description  = "VNC Server";
        extraGroups  = [ "wheel" "networkmanager" "input" "video" "sound"];
        openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCiK6FYG5u6y10hJu3VTytiDh5XY1i11m1hft1xKLj9Hv4kGEdP3yTkEIZfKmkD3Kl8yT2QYAii6ec2ZVveLXHeTgBN6Ew483UJ7dDJ/H53XqHKd9c3gY0HgG0KiyW6cMqibQ6g9THl3GaYq1zSVqLSM7WMVlCc5bugy3TE72PK+SoVW5vt9c9b56q9YazFsH9hNq9ybAF4W2wFGduev9PnqorgND5QtdNpBKnM+IKRnGFrQ5sbKlo/Rc14zb4UqSOCfpVHmQrcS3aK3eeBn4+AtPHBAIe43MyS7+JmUQHvcTzm6/vobAP1E2NimkWJS2TD6zEdPu06GR6PXRjC6y2Zhp/7truzKhxMkFo0wDXlV5cgmD3v68Mt0otzwtDN8qbMzBObPyqiIt3mjbDHRdpE72/eAkU4KkwnbolaaTfpSO4ishpn0/nBReiIrP+U+U4ssrAAAQ3efAnSYa++B7a0fOd4s43leOp9VKHGw1iu0UVS1hGcL4hbrU23LMOKPKE=" ];
    };

    security.sudo.extraRules = [
        {  
            users = [ "vnc" ];
            commands = [
                { 
                    command = "ALL" ;
                    options= [ "NOPASSWD" ];
                }
            ];
        }
    ];

    # Steam
    programs.steam.enable = true;

    # Enable OpenGL
    hardware.opengl = {
        enable = true;
        driSupport = true;
        driSupport32Bit = true;
    };

    # NVidia
    hardware.nvidia = {

        # Modesetting is required.
        modesetting.enable = true;

        # Nvidia power management. Experimental, and can cause sleep/suspend to fail.
        powerManagement.enable = false;

        # Fine-grained power management. Turns off GPU when not in use.
        # Experimental and only works on modern Nvidia GPUs (Turing or newer).
        powerManagement.finegrained = false;

        # Use the NVidia open source kernel module (not to be confused with the
        # independent third-party "nouveau" open source driver).
        # Support is limited to the Turing and later architectures. Full list of 
        # supported GPUs is at: 
        # https://github.com/NVIDIA/open-gpu-kernel-modules#compatible-gpus 
        # Only available from driver 515.43.04+
        # Currently alpha-quality/buggy, so false is currently the recommended setting.
        open = false;

        # Enable the Nvidia settings menu,
        # accessible via `nvidia-settings`.
        nvidiaSettings = true;

        # Optionally, you may need to select the appropriate driver version for your specific GPU.
        # package = config.boot.kernelPackages.nvidiaPackages.stable;
    };
    
}