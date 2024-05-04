{ modulesPath, pkgs, lib, config, ... }: 
with lib;
let
  cfg = config.services.wolf;

  wolfComposeFile = pkgs.writeTextFile {
    name = "docker-compose.yml";
    text = builtins.readFile ./docker-compose.nvidia.yml;
  };

  wolfComposeStartScript = pkgs.writeTextFile {
    name = "docker-nvidia-start.sh";
    text = builtins.readFile ./docker-nvidia-start.sh;
    executable = true;
  };

in
{

  options.services.wolf = {
    enable = mkEnableOption "wolf service";
  };

  config = mkIf cfg.enable {
    # SSH and Wolf ports
    # See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
    networking.firewall = {
      allowedTCPPorts = [ 
          22    # SSH
          47984 # HTTP
          47989 # HTTPS
          48010 # RTSP
      ];
      allowedUDPPorts = [ 
          47999 # Control
      ];
      allowedUDPPortRanges = [
          { from = 48100; to = 48100; } # Video (up to 10 users)
          { from = 48200; to = 48210; } # Audio (up to 10 users)
      ];
    };
    
    virtualisation.docker = {
      enable = true;
      enableOnBoot = true;
    }; 

    # Required to simulate input
    boot.kernelModules = [ "uinput" ];

    services.udev.extraRules = ''
        # From https://games-on-whales.github.io/wolf/stable/user/quickstart.html#_virtual_devices_support
        # Allows Wolf to acces /dev/uinput
        KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", OPTIONS+="static_node=uinput"

        # Move virtual keyboard and mouse into a different seat
        SUBSYSTEMS=="input", ATTRS{id/vendor}=="ab00", MODE="0660", GROUP="input", ENV{ID_SEAT}="seat9"

        # Joypads
        SUBSYSTEMS=="input", ATTRS{name}=="Wolf X-Box One (virtual) pad", MODE="0660", GROUP="input"
        SUBSYSTEMS=="input", ATTRS{name}=="Wolf PS5 (virtual) pad", MODE="0660", GROUP="input"
        SUBSYSTEMS=="input", ATTRS{name}=="Wolf gamepad (virtual) motion sensors", MODE="0660", GROUP="input"
        SUBSYSTEMS=="input", ATTRS{name}=="Wolf Nintendo (virtual) pad", MODE="0660", GROUP="input"   
    '';

    # Wold as Docker Compose service
    systemd.services.wolf = {
      description = "Wolf as a Docker service";
      after = [ "network.target" "docker.service" ];
      wants = [ "docker.service" ];
      script = ''
        ${wolfComposeStartScript} ${wolfComposeFile} 
      '';
      serviceConfig = {
        Environment = "PATH=/run/current-system/sw/bin:" + makeBinPath [ pkgs.curl pkgs.docker ];
        # Ensures the service executes on startup
        Type = "oneshot";
        RemainAfterExit = true;
        User = "root";
        Group = "root";
      };
      # Ensures the service is started at boot
      wantedBy = [ "multi-user.target" ];
    };
  };

}
