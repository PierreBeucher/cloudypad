# Connect via SSH to instance

You specified an SSH key when creating your instance. Retrieve your instance details to show its IP and SSH user:

```sh 
$ cloudypad get mypad
{
  "name": "mypad",
  "host": "5.120.23.178", <==== Instance IP
  "ssh": {
    "privateKeyPath": "/home/crafteo/.ssh/id_ed25519",
    "user": "ubuntu"  <===== SSH user
  },
  "status": {
    ...
  },
  "provider": {
    "aws": {
      ...
    }
  },
}
```

Connect via SSH:

```sh
ssh ubuntu@5.120.23.178

# If needed, specify SSH key
ssh -i /home/crafteo/.ssh/id_ed25519 ubuntu@5.120.23.178
```