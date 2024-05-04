import { NixOSModule } from "../modules.js"

export function awsBase() : NixOSModule {
    const nixConfig = `
        { modulesPath, pkgs, lib, config, home-manager, ... }: let
            
        in {
            imports = [ 
                "$\{modulesPath}/virtualisation/amazon-image.nix"  # NixOS built-in config for AWS, do not remove
                home-manager.nixosModules.default
            ];

            system.stateVersion = "23.11";
        }
    `

    return {
        sourceContent: nixConfig,
        name: "aws-base.nix",
        dependsOn: [],
    }
}

