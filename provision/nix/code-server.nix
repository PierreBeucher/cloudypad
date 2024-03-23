{ modulesPath, pkgs, lib, config, ... }: let
    
in {
  imports = [ 
    "${modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
        ./modules/code-server.nix
    ];

    services.cloudybox-code-server = {
        enable = true;
        hashedPassword = "$argon2i$v=19$m=4096,t=3,p=1$W6P5b7te1jM+B8Ah4GmByA$CWeNHUmjFFO4yt6wCfvvXP302wjiTXCQrvYpe9EiosA";
    };

    system.stateVersion = "23.05";
    nixpkgs.config.allowUnfree = true;
}
