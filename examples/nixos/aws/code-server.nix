{ modulesPath, pkgs, lib, config, ... }: let
    
in {
    imports = [ 
        ./modules/code-server.nix
    ];

    services.cloudybox.code-server = {
        enable = true;
        hashedPassword = "$argon2i$v=19$m=4096,t=3,p=1$chCcyupRyi2FQN9Tr5wxsw$IimxXpxNCS4Vn1Hyo8PmPq2zPUGsZOEHRQWVP3cWcX4";
    };

    nixpkgs.config.allowUnfree = true;
}
