{ modulesPath, pkgs, lib, config, ... }: let
    
in {
  imports = [ 
        ./modules/nvidia.nix
        ./modules/wolf.nix
        ./modules/code-server.nix
        ./modules/docker.nix
    ];

    services.wolf = {
        enable = true;
    };

    services.nvidia = {
        enable = true;
    };
    
    nixpkgs.config.allowUnfree = true;
}
