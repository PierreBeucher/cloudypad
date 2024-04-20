{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: 
    flake-utils.lib.eachDefaultSystem (system:
      let  
        pkgs = nixpkgs.legacyPackages.${system}; 
        plandex = pkgs.stdenv.mkDerivation {
          name = "plandex";
          
          src = builtins.fetchurl {
            url = "https://github.com/plandex-ai/plandex/releases/download/cli/v0.8.3/plandex_0.8.3_linux_amd64.tar.gz";
            sha256 = "sha256:1bgxm3lhvs02jwmw3918j63cd0ycyykmbddsbwvyz4wjbvyx1mlz";
          };

          unpackPhase = "tar -zxvf $src";

          installPhase = ''
            mkdir -p $out/bin
            cp -r * $out/bin
          '';

          meta = {
            description = "Plandex CLI";
            homepage = "https://github.com/plandex-ai/plandex";
          };
        };
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
              plandex
            ];
            
            shellHook = ''
            '';
          };
        };
      }
    );
}
