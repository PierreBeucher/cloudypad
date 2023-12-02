{ modulesPath, pkgs, lib, config, ... }: let
    
    configFile = pkgs.writeTextDir "config/sunshine.conf"
        ''
        origin_web_ui_allowed=wan
        '';

in {
    
    networking.firewall = {
        # SSH and Sunshine ports
        # See https://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
        allowedTCPPorts = [ 22 47984 47989 47990 47998 47999 48000 48002 48010];
    };

    environment.systemPackages = with pkgs; [
        sunshine
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

    services.udev.extraRules = ''
      KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"
    '';
    
}