{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: 
    flake-utils.lib.eachDefaultSystem (system:
      let  
        pkgs = import nixpkgs { system = system; config.allowUnfree = true; };
        cloudypadVersion = "0.39.0";
      in {
        packages = rec {
          default = cloudypad;
          cloudypad  = pkgs.stdenv.mkDerivation {
            pname = "cloudypad";
            version = cloudypadVersion;

            src = pkgs.fetchurl {
              url = "https://raw.githubusercontent.com/PierreBeucher/cloudypad/v${cloudypadVersion}/cloudypad.sh";
              hash = "sha256:0b7y16sl5abvgg5g2lqg1lkfvbw6x1jpw38y40ifcm9s90h1igc0";
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
            ];
            
            shellHook = ''
              # Set Pulumi backend and Cloudy Pad to integration test
              export PULUMI_BACKEND_URL="file://$PWD/test/integ/.data-root-dir/pulumi"
              export PULUMI_CONFIG_PASSPHRASE=""

              export CLOUDYPAD_HOME="$PWD/test/integ/.data-root-dir"

              export PAPERSPACE_API_KEY=$(cat $PWD/tmp/paperspace_api_key)
              export LINODE_TOKEN=$(cat $PWD/tmp/linode_token)

              export CLOUDYPAD_KEYBOARD_LAYOUT_AUTODETECT_SKIP_WAYLAND_WARNING=true
            '';
          };
        };
      }
    );
}
