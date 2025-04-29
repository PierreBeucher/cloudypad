# Connect via SSH to instance

Your instance specify an SSH user and either a key path or base64-encoded content. 

```sh
$ cloudypad get mypad
{
  "name": "mypad",
  "host": "1.123.45.xxx", <==== Instance IP
  "ssh": {
    "privateKeyPath": "/home/crafteo/.ssh/id_ed25519",
    # OR
    "privateKeyContentBase64": "...KeyContentAsVeryLongString...",
    "user": "ubuntu"  <===== SSH user
  },
  # ...
}
```

If your instance uses `privateKeyContentBase64` (a base64-encoded private SSH key), decode it and use it with `ssh`. For example:

```sh
# Create a file only current user can access to write our key in
touch /tmp/my-instance-key 
chmod 0600 /tmp/my-instance-key

# Decode key into our file
cloudypad get mypad | jq -r .provision.input.ssh.privateKeyContentBase64 | base64 -d > /tmp/my-instance-key
# Note: jq is a JSON parser you may need to install
# Otherwise copy/paste key content and use echo directly such as
# echo "...KeyContentAsVeryLongString..." | base64 -d > /tmp/my-instance-key

# Connect to instance using key
ssh -i /tmp/my-instance-key ubuntu@1.123.45.xxx
```

If your instance uses a key path, you can use it directly:

```sh
ssh -i /home/crafteo/.ssh/id_ed25519 ubuntu@1.123.45.xxx
```
