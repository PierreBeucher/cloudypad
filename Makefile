SUNSHINE_HOST = 13.37.83.197
#sunshine.devops.crafteo.io

.PHONY: nix-config
nix-config:
	scp -i .ssh/key provision/configuration.nix root@$(SUNSHINE_HOST):/etc/nixos/configuration.nix
	ssh -i .ssh/key root@$(SUNSHINE_HOST) nixos-rebuild switch

# This ought to be in NixOS or as Ansible
# Let's make it work and to that later 
.PHONY: sunshine
sunshine:
	ssh -i .ssh/key sunshine@$(SUNSHINE_HOST) mkdir -p .config/sunshine
	scp -i .ssh/key provision/sunshine.conf sunshine@$(SUNSHINE_HOST):./.config/sunshine/sunshine.conf
	scp -i .ssh/key provision/start-sunshine.sh sunshine@$(SUNSHINE_HOST):./start-sunshine.sh
	ssh -i .ssh/key sunshine@$(SUNSHINE_HOST) ./start-sunshine.sh

.PHONY: infra
infra:
	pulumi -C infra up -yf

.PHONY: refresh
refresh:
	pulumi -C infra refresh -y

.PHONY: destroy
destroy:
	pulumi -C infra destroy -yfr

.PHONY: ssh
ssh:
	ssh -i .ssh/key root@$(SUNSHINE_HOST)

.PHONY: select
select: 
	pulumi -C infra/ stack select
