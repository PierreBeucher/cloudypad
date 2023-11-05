SUNSHINE_HOST = sunshine.devops.crafteo.io

.PHONY: nix-config
nix-config:
	scp -i .ssh/key provision/configuration.nix root@$(SUNSHINE_HOST):/etc/nixos/configuration.nix
	ssh -i .ssh/key root@$(SUNSHINE_HOST) nixos-rebuild switch

sunshine-config:
	scp -i .ssh/key provision/sunshine.conf root@$(SUNSHINE_HOST):/root/.config/sunshine/sunshine.conf

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