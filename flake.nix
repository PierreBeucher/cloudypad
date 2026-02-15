{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    novops.url = "github:PierreBeucher/novops";
  };

  outputs = { self, nixpkgs, flake-utils, novops }: 
    flake-utils.lib.eachDefaultSystem (system:
      let  
        pkgs = import nixpkgs { system = system; config.allowUnfree = true; };
        cloudypadVersion = "0.42.0";
      in {
        packages = rec {
          default = cloudypad;
          cloudypad  = pkgs.stdenv.mkDerivation {
            pname = "cloudypad";
            version = cloudypadVersion;

            src = pkgs.fetchurl {
              url = "https://raw.githubusercontent.com/PierreBeucher/cloudypad/v${cloudypadVersion}/cloudypad.sh";
              hash = "sha256:0i56zvi4q827ar7fbif4z74ap1z9jxs22wibj07c0qbv995i9w8f";
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
          novops = novops.packages.${system}.novops;
        };
        devShells = {
          default = pkgs.mkShell {
            packages = [
              (with pkgs; [
                gnumake
                pulumi-bin
                pulumiPackages.pulumi-nodejs
                nodejs_22
                go-task
                gettext
                typescript
                podman
                podman-compose
                ansible
                sshpass # for Ansible password auth
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
                bc
                linode-cli
                google-cloud-sdk
              ])
              novops.packages.${system}.novops
            ];
            
            shellHook = ''
              # Set Pulumi backend and Cloudy Pad to integration test
              export PULUMI_BACKEND_URL="file://$PWD/test/integ/.data-root-dir/pulumi"
              export PULUMI_CONFIG_PASSPHRASE=""

              export CLOUDYPAD_HOME="$PWD/test/integ/.data-root-dir"

              export PAPERSPACE_API_KEY=$(cat $PWD/tmp/paperspace_api_key)
              export LINODE_TOKEN=$(cat $PWD/tmp/linode_token)

              export CLOUDYPAD_KEYBOARD_LAYOUT_AUTODETECT_SKIP_WAYLAND_WARNING=true

              # Force NODE_ENV as Cursor seems to set it to production
              # See https://forum.cursor.com/t/agent-shell-set-node-env-to-production/134489
              export NODE_ENV=development

              # Force max old space size to 8GB for Node.js as compilation is very memory intensive
              export NODE_OPTIONS="--max-old-space-size=8912"
            '';
          };
        };
      }
    );
}
