{ modulesPath, pkgs, lib, config, ... }: let
    
in {
    imports = [ 
        "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove TODO include by default
        ./sunshine/headless-desktop.nix
        ./sunshine/nvidia.nix
        ./sunshine/sunshine.nix
    ] ++ lib.optional (builtins.pathExists ./modules/custom-config.nix) ./modules/custom-config.nix;

    nixpkgs.config.allowUnfree = true;
}