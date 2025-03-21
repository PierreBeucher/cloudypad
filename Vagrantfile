# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
    config.vm.box = "ubuntu/jammy64"  # Ubuntu 22.04 LTS (Jammy)
    config.vm.hostname = "cloudypad-dev"
  
    config.vm.network "private_network", ip: "192.168.56.43"

    # Sunshine access
    config.vm.network "forwarded_port", guest: 47990, host: 47990

    config.vm.provider "virtualbox" do |vb|
      vb.memory = "8192"
      vb.cpus = 8
    end
  
    config.vm.provision "shell", inline: <<-SHELL
      # apt-get update
    SHELL
  end