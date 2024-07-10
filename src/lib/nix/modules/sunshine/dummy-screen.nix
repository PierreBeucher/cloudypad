# Module to enable a dummy screen for instances without GPU and specific driver configs
# Used for testing on small cheap instances
{ lib, pkgs, config, ... }: {
    
    services.xserver = {
        videoDrivers = ["dummy"];
        
        # Dummy screen
        monitorSection = ''
            HorizSync 28.0-80.0
            VertRefresh 48.0-75.0
            Modeline "1920x1080_60.00" 172.80 1920 2040 2248 2576 1080 1081 1084 1118 -HSync +Vsync
        '';

        deviceSection = ''
            Driver "dummy"
            VideoRam 256000
        '';

        screenSection = ''
            DefaultDepth 24
            SubSection "Display"
                Depth 24
                Modes "1920x1080_60.00"
            EndSubSection
        '';
    };
}