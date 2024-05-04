{ lib, pkgs, config, ... }:
with lib;
let
  cfg = config.services.cloudybox.code-server;
in
{
  # Declare what settings a user of this "hello.nix" module CAN SET.
  options.services.cloudybox.code-server = {
    enable = mkEnableOption "code-server service";

    port = mkOption {
      type = types.port;
      default = 8080;
    };

    user = mkOption {
      type = types.str;
      default = "root";
    };

    host = mkOption {
      type = types.str;
      default = "0.0.0.0";
    };

    hashedPassword = mkOption {
      type = types.str;
      description = "Hashed password. Create one with echo -n 'pass' | npx argon2-cli -e";
    };

  };

  config = mkIf cfg.enable {
    nixpkgs.config.permittedInsecurePackages = [
        "nodejs-16.20.0"
        "nodejs-16.20.2"
    ];

    networking.firewall = {
      allowedTCPPorts = [ 
          cfg.port
      ];
    };

    services.code-server = {
      enable = true;
      user = cfg.user;
      host = cfg.host;
      port = cfg.port;
      auth = "password";
      hashedPassword = cfg.hashedPassword;
    }; 
  };
}