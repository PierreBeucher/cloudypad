{ modulesPath, pkgs, lib, config, ... }: 
let
  wolfCompose = pkgs.writeTextFile {
    name = "docker-compose.yml";
    text = builtins.readFile ./docker-compose.yml;
  };
in
{
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

    # Copy Wolf config Docker compose files in user home


    home-manager.users.root = {
      home.file."wolf/docker-compose.nvidia.yml" = {
        source = ./wolf/docker-compose.nvidia.yml;
      };
      home.file."wolf/docker-nvidia-start.sh" = {
        source = ./wolf/docker-nvidia-start.sh;
        executable = true;
      };

      home.stateVersion = "23.05";
    };

}
