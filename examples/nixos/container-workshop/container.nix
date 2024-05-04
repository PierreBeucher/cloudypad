{ modulesPath, config, pkgs, ... }: {

    nixpkgs.config.allowUnfree = true;

    # OS packages
    environment.systemPackages = with pkgs; [
      
      # Misc
      busybox
      vim
      gnupg
      gnumake
      htop
      unzip
      openssl
      jq
      dive
      git
      awscli2
      
      # Python and packages (used by Ansible for post-deploy config and tests)
      (python310.withPackages(ps: with ps; [
        pip
        docker
        docker-compose # this does not fail on rebuild but does not provide "compose" Python module :(
        pyyaml
      ]))

      # Network
      bind 
      traceroute
      sshpass
      
      # Docker
      docker
      docker-compose
      dive
      podman

      # K8S
      k3s
      k9s
      kubectl
      kubernetes-helm

      # Node & TS
      nodejs_20
      typescript

    ];

    # user with password and docker access
    users.users.crafteo = {
      isNormalUser = true;
      home = "/home/crafteo";
      extraGroups = [ "networkmanager" "wheel" "docker" ];
    };

    # Code Server running for user
    services.code-server = {
      enable = true;
      user = "crafteo";
      host = "0.0.0.0";
      port = 8080;
      auth = "password";
      hashedPassword = "$argon2i$v=19$m=4096,t=3,p=1$TRJIs+qFhbjP1hWg66wOLQ$gF0djnWvfLINoPt6jgNMwJ2brOiIJCh23qGBFX1CDg0";
    }; 

    # Required for code-server
    nixpkgs.config.permittedInsecurePackages = [
      "nodejs-16.20.0"
    ];

    # Docker
    virtualisation.docker = {
      enable = true;
      enableOnBoot = true;
    };

    # Allow passwordless sudo
    security.sudo.extraRules= [
      {  users = [ "crafteo" ];
        commands = [
          { command = "ALL" ;
            options= [ "NOPASSWD" ]; # "SETENV" # Adding the following could be a good idea
          }
        ];
      }
    ];

    # Allow all ports as we're in a sandbox environment
    networking.firewall = {
      # enable = true;
      allowedTCPPortRanges = [ { from = 0; to = 65535; } ];
      allowedUDPPortRanges = [ { from = 0; to = 65535; } ];
    };

    # Generous swap
    swapDevices = [ {
      device = "/var/lib/swapfile";
      size = 4*1024;
    } ];
}