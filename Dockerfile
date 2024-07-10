FROM python:3.12.4-bookworm

#
# Global tooling
#
RUN apt update && apt install jq yq -y

# Ansible
RUN python3 -m pip install ansible==10.1.0

# Shorter logs output
ENV ANSIBLE_STDOUT_CALLBACK=community.general.unixy

# Paperspace CLI
RUN curl -fsSL https://paperspace.com/install.sh | sh

ENV PATH="$PATH:/root/.paperspace/bin"

#
# Cloudy Pad 
#

WORKDIR /cloudypad

COPY ansible ansible/

RUN ansible-galaxy role install -r ansible/requirements.yml
RUN ansible-galaxy collection install -r ansible/requirements.yml