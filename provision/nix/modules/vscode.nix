{ lib, pkgs, config, ... }: {
    
    nixpkgs.config.permittedInsecurePackages = [
        "nodejs-16.20.0"
        "nodejs-16.20.2"
    ];

    networking.firewall = {
      allowedTCPPorts = [ 
          8080
      ];
    };

    services.code-server = {
      enable = true;
      user = "root";
      host = "0.0.0.0";
      port = 8080;
      auth = "password";
      hashedPassword = "$argon2i$v=19$m=4096,t=3,p=1$0ISdEEoXEOkZs2B9L2EhkQ$p51JtcYA0eeU+12CovRVsbGHZpw8Zwtwv/pHkc3QoC0";
    }; 

}