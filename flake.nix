{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: 
    flake-utils.lib.eachDefaultSystem (system:
      let  
        pkgs = nixpkgs.legacyPackages.${system}; 
      in {
        devShells = {
          default = pkgs.mkShell {
            packages = with pkgs; [
              gnumake
              pulumi
              pulumiPackages.pulumi-language-nodejs
              nodePackages.pnpm
              go-task
              gettext
              typescript
              podman
              podman-compose
              ansible
              yq
              jq
            ];
            
            shellHook = ''
              export PULUMI_BACKEND_URL="file://$HOME/.cloudypad/pulumi-backend"
              export PULUMI_CONFIG_PASSPHRASE=""
            '';
          };
        };
      }
    );
}
