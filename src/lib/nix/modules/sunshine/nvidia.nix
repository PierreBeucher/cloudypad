{ modulesPath, pkgs, lib, config, ... }: {

    # OS packages
    environment.systemPackages = with pkgs; [
        nvtop-nvidia
    ];
    
    services.xserver = {
        videoDrivers = ["nvidia"];
        
        # Dummy screen
        monitorSection = ''
            Option "Enable" "true"
        '';

        deviceSection = ''
            Driver "nvidia"
            VendorName "NVIDIA Corporation"
            Option "MetaModes" "1920x1080"
            Option "ConnectedMonitor" "None-1"
            Option "ModeValidation" "NoDFPNativeResolutionCheck,NoVirtualSizeCheck,NoMaxPClkCheck,NoHorizSyncCheck,NoVertRefreshCheck,NoWidthAlignmentCheck"
        '';

        screenSection = ''
            DefaultDepth 24
            Option "TwinView" "True"
            SubSection "Display"
                Modes "1920x1080"
            EndSubSection
        '';
    };

    hardware.opengl = {
        enable = true;
        driSupport = true;
        driSupport32Bit = true;
    };

    # Snippet from https://nixos.wiki/wiki/Nvidia
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