{ modulesPath, pkgs, lib, config, ... }: let
    
in {
    imports = [ 
        "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
        ./modules/nvidia.nix
        ./modules/wolf.nix
        ./modules/vscode.nix
        ./modules/docker.nix
    ];

    system.stateVersion = "23.05";
    nixpkgs.config.allowUnfree = true;
}
