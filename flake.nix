{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: 
    flake-utils.lib.eachDefaultSystem (system:
      let  
        pkgs = nixpkgs.legacyPackages.${system}; 
        cloudypadVersion = "0.4.0";
      in {
        packages = rec {
          default = cloudypad;
          cloudypad  = pkgs.stdenv.mkDerivation {
            pname = "cloudypad";
            version = cloudypadVersion;

            src = pkgs.fetchurl {
              url = "https://raw.githubusercontent.com/PierreBeucher/cloudypad/v${cloudypadVersion}/cloudypad.sh";
              hash = "sha256:1g3bqbfv0nzjm13x8kv29rnc13jqhzszhwr1ryb61jqqs1lw7pjw";
            };

            phases = [ "installPhase" ];

            installPhase = ''
              install -Dm755 $src $out/bin/cloudypad
            '';

            meta = with pkgs.lib; {
              description = "Cloudypad script";
              homepage = "https://github.com/PierreBeucher/cloudypad";
              license = licenses.gpl3;
            };
          };
          
        };
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
              gh
            ];
            
            shellHook = ''
              export PULUMI_BACKEND_URL="file://$HOME/.cloudypad/pulumi-backend"
              export PULUMI_CONFIG_PASSPHRASE=""

              export PAPERSPACE_API_KEY_FILE=$PWD/tmp/paperspace_api_key
            '';
          };
        };
      }
    );
}
