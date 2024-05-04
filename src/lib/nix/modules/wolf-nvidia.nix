{ modulesPath, pkgs, lib, config, ... }: let
    
in {
  imports = [ 
        ./wolf/nvidia.nix
        ./wolf/wolf.nix
    ];

    services.wolf = {
        enable = true;
    };

    services.nvidia = {
        enable = true;
    };
    
    nixpkgs.config.allowUnfree = true;
}
