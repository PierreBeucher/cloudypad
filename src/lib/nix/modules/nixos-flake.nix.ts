import { NixOSModule } from "../interfaces.js";

export function osFlake(modules: string[]) : NixOSModule {
  const n = `
    {
      inputs.nixpkgs.url = github:NixOS/nixpkgs/nixos-unstable;
      inputs.home-manager.url = github:nix-community/home-manager;
    
      outputs = { self, nixpkgs, ... }@attrs: {
        nixosConfigurations.cloudybox = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          specialArgs = attrs;
          modules = [ 
            ${modules.map(m => `./${m}`).join("\n            ")}
          ];
        };
      };
    }
  `

  return {
    content: n,
    name: "flake.nix",
    modules: [],
  }
}
