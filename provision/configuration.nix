{ modulesPath, pkgs, lib, config, ... }: {
    imports = [ 
        "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
    ];

    nixpkgs.config.allowUnfree = true; 
  
    networking.firewall = {
      # enable = true;
      allowedTCPPortRanges = [ { from = 0; to = 65535; } ];
      allowedUDPPortRanges = [ { from = 0; to = 65535; } ];
    };   

    system.stateVersion = "23.05";

    # OS packages
    environment.systemPackages = with pkgs; [
        sunshine
        xorg.xrandr
    ];

    # X and audio
    services.xserver = {
        enable = true;
        videoDrivers = ["nvidia"];
        
        displayManager.startx.enable = true;

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

    # Force stop udisks2 (conflict with Gnome)
    services.udisks2.enable = lib.mkForce false;

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