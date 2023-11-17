SUNSHINE_HOST = sunshine-fast.devops.crafteo.io
NIX_CONFIG = "provision/configuration-sunshine.nix"

.PHONY: nix-config
nix-config:
	scp -i .ssh/key $(NIX_CONFIG) root@$(SUNSHINE_HOST):/etc/nixos/configuration.nix
	# workaround for sunshine which crashes if .config doesn't exists
	# only present on Sunshine 0.19.1 (NixOS 23.05), seems OK with later versions
	# probably using a solution with Home Manager would be cleaner
	ssh -i .ssh/key root@$(SUNSHINE_HOST) mkdir -p .config
	ssh -i .ssh/key root@$(SUNSHINE_HOST) nixos-rebuild switch

# This ought to be in NixOS or as Ansible
# Let's make it work and to that later 
.PHONY: sunshine
sunshine:
	ssh -i .ssh/key sunshine@$(SUNSHINE_HOST) mkdir -p .config/sunshine
	scp -i .ssh/key provision/sunshine.conf sunshine@$(SUNSHINE_HOST):./.config/sunshine/sunshine.conf
	scp -i .ssh/key provision/start-sunshine.sh sunshine@$(SUNSHINE_HOST):./start-sunshine.sh
	ssh -i .ssh/key sunshine@$(SUNSHINE_HOST) ./start-sunshine.sh

# This ought to be in NixOS or as Ansible
# Let's make it work and to that later 
.PHONY: vnc
vnc:
	ssh -i .ssh/key vnc@$(SUNSHINE_HOST) Xvnc :30 -iglx -depth 24 -rfbwait 120000 -deferupdate 1 -localhost -verbose -securitytypes none

.PHONY: infra
infra:
	pulumi -C infra up -yf

.PHONY: refresh
refresh:
	pulumi -C infra refresh -y

.PHONY: destroy
destroy:
	pulumi -C infra destroy -yfr

.PHONY: start
start:
	 aws ec2 start-instances --instance-ids $$(pulumi -C infra stack output infra | jq .instanceId -r)

.PHONY: stop
stop:
	 aws ec2 stop-instances --instance-ids $$(pulumi -C infra stack output infra | jq .instanceId -r)

.PHONY: reboot
reboot:
	ssh -i .ssh/key root@$(SUNSHINE_HOST) reboot

.PHONY: ssh
ssh:
	ssh -i .ssh/key root@$(SUNSHINE_HOST)

.PHONY: select
select: 
	pulumi -C infra/ stack select
