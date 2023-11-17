{ modulesPath, pkgs, lib, config, ... }: let
    
    configFile = pkgs.writeTextDir "config/sunshine.conf"
        ''
        origin_web_ui_allowed=wan
        '';

in {
    imports = [ 
        "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
    ];

    nixpkgs.config.allowUnfree = true; 

    networking.firewall = {
      # enable = true;
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

    system.stateVersion = "23.05";

    # OS packages
    environment.systemPackages = with pkgs; [
        sunshine
        xorg.xrandr
    ];
    
    # X and audio
    sound.enable = true;
    hardware.pulseaudio.enable = true;
    security.rtkit.enable = true;
    
    services.xserver = {
        enable = true;
        videoDrivers = ["nvidia"];
        
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

        # Dummy screen
        monitorSection = ''
            VendorName     "Unknown"
            HorizSync   30-85
            VertRefresh 48-120

            ModeLine        "1920x1080" 148.35  1920 2008 2052 2200 1080 1084 1089 1125
            ModelName      "Unknown"
            Option         "DPMS"
        '';

        deviceSection = ''
            VendorName "NVIDIA Corporation"
            Option      "AllowEmptyInitialConfiguration"
            Option      "ConnectedMonitor" "DFP"
            Option      "CustomEDID" "DFP-0"

        '';

        screenSection = ''
            DefaultDepth    24
            Option      "ModeValidation" "AllowNonEdidModes, NoVesaModes"
            Option      "MetaModes" "1920x1080"
            SubSection     "Display"
                Depth       24
            EndSubSection
        '';
    };

    # Sunshine user, service and config 
    users.users.sunshine = {
        isNormalUser  = true;
        home  = "/home/sunshine";
        description  = "Sunshine Server";
        extraGroups  = [ "wheel" "networkmanager" "input" "video" "sound"];
        openssh.authorizedKeys.keys = [ "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCiK6FYG5u6y10hJu3VTytiDh5XY1i11m1hft1xKLj9Hv4kGEdP3yTkEIZfKmkD3Kl8yT2QYAii6ec2ZVveLXHeTgBN6Ew483UJ7dDJ/H53XqHKd9c3gY0HgG0KiyW6cMqibQ6g9THl3GaYq1zSVqLSM7WMVlCc5bugy3TE72PK+SoVW5vt9c9b56q9YazFsH9hNq9ybAF4W2wFGduev9PnqorgND5QtdNpBKnM+IKRnGFrQ5sbKlo/Rc14zb4UqSOCfpVHmQrcS3aK3eeBn4+AtPHBAIe43MyS7+JmUQHvcTzm6/vobAP1E2NimkWJS2TD6zEdPu06GR6PXRjC6y2Zhp/7truzKhxMkFo0wDXlV5cgmD3v68Mt0otzwtDN8qbMzBObPyqiIt3mjbDHRdpE72/eAkU4KkwnbolaaTfpSO4ishpn0/nBReiIrP+U+U4ssrAAAQ3efAnSYa++B7a0fOd4s43leOp9VKHGw1iu0UVS1hGcL4hbrU23LMOKPKE=" ];
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

    security.wrappers.sunshine = {
        owner = "root";
        group = "root";
        capabilities = "cap_sys_admin+p";
        source = "${pkgs.sunshine}/bin/sunshine";
    };

    # Inspired from https://github.com/LizardByte/Sunshine/blob/5bca024899eff8f50e04c1723aeca25fc5e542ca/packaging/linux/sunshine.service.in
    systemd.user.services.sunshine = {
        description = "Sunshine server";
        wantedBy = [ "graphical-session.target" ];
        startLimitIntervalSec = 500;
        startLimitBurst = 5;
        partOf = [ "graphical-session.target" ];
        wants = [ "graphical-session.target" ];
        after = [ "graphical-session.target" ];

        serviceConfig = {
            ExecStart = "${config.security.wrapperDir}/sunshine ${configFile}/config/sunshine.conf";
            Restart = "on-failure";
            RestartSec = "5s";
        };
    };
    
    # Avahi is used by Sunshine
    services.avahi.publish.userServices = true;

    # Required to simulate input
    boot.kernelModules = [ "uinput" ];

    # Maybe not necessary ? udev rules are ignored with ssh ?
    services.udev.extraRules = ''
      KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"
    '';

    # Force stop udisks2 (conflict with Gnome)
    services.udisks2.enable = lib.mkForce false;

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