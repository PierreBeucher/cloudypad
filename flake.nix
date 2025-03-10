{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: 
    flake-utils.lib.eachDefaultSystem (system:
      let  
        pkgs = import nixpkgs { system = system; config.allowUnfree = true; };
        cloudypadVersion = "0.18.0";
      in {
        packages = rec {
          default = cloudypad;
          cloudypad  = pkgs.stdenv.mkDerivation {
            pname = "cloudypad";
            version = cloudypadVersion;

            src = pkgs.fetchurl {
              url = "https://raw.githubusercontent.com/PierreBeucher/cloudypad/v${cloudypadVersion}/cloudypad.sh";
              hash = "sha256:0p1lp06drs30m6y624xqxh219f6zqknysfz9dpqbwqa66qmwpbaa";
            };

            phases = [ "installPhase" ];

            installPhase = ''
              install -Dm755 $src $out/bin/cloudypad
            '';

            meta = with pkgs.lib; {
              description = "Cloudypad script";
              homepage = "https://github.com/PierreBeucher/cloudypad";
              license = licenses.agpl3Plus;
            };
          };
          
        };
        devShells = {
          default = pkgs.mkShell {
            packages = with pkgs; [
              gnumake
              pulumi-bin
              pulumiPackages.pulumi-language-nodejs
              nodejs_22
              go-task
              gettext
              typescript
              podman
              podman-compose
              ansible
              yq
              jq
              gh
              mdbook
              pv # for demo-magic
              asciinema
              imagemagick_light
              ffmpeg
              vagrant
              scaleway-cli

              google-cloud-sdk
            ];
            
            shellHook = ''
              export PULUMI_BACKEND_URL="file://$HOME/.cloudypad/pulumi-backend"
              export PULUMI_CONFIG_PASSPHRASE=""

              export PAPERSPACE_API_KEY=$(cat $PWD/tmp/paperspace_api_key)
            '';
          };
        };
      }
    );
}
