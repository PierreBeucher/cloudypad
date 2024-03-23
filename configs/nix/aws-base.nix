{ modulesPath, pkgs, lib, config, ... }: let
    
in {
    imports = [ 
        "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
        <home-manager/nixos>
    ];

    system.stateVersion = "23.05";
}
