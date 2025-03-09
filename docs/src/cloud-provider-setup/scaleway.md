# Scaleway account setup

If you don't already have an Scaleway account, [create an account](https://www.scaleway.com) or use an existing account.

Configure your credentials using `scw` CLI, [see official documentation](https://cli.scaleway.com/#installation)

Check your configuration:

```sh
scw info
```

You do not need additional configuration appart, maybe, a Quota increase (see below). SSH key needed to access the instance will be configured by Cloudypad.

## Quotas

You may need to increase quota to create the desired instance type. If you get an error related to quota:
- Go to [Scaleway Quota dashboard](https://console.scaleway.com/organization/quotas)
- Search for "GPU" and identify the quota you need to increase
- Fill a quota increase request