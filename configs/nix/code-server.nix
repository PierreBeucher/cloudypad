{ modulesPath, pkgs, lib, config, ... }: let
    
in {
  imports = [ 
    "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
        ./modules/code-server.nix
    ];

    services.cloudybox-code-server = {
        enable = true;
        hashedPassword = "$argon2i$v=19$m=4096,t=3,p=1$bVCx3O3GH9h+kmotPNNnWA$4IZMEwSXGuXhoGW6/lcH1wwSd6CmGaShq3InXcr4FMU";
    };

    system.stateVersion = "23.05";
    nixpkgs.config.allowUnfree = true;
}
