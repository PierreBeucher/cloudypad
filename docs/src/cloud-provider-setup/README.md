# Provider setup

Providers are methods used by Cloudy Pad to deploy gaming instances.

Supported providers:

- [SSH](./ssh) - Deploy on your own server or machine directly via SSH
- [AWS](./aws.md) - Create an instance directly on AWS
- [Azure](./azure.md) - Create an instance directly on Microsoft Azure
- [Google Cloud](./gcp.md) - Create an instance directly on Google Cloud
- [Scaleway](./scaleway.md) - Create an instance directly on Scaleway
- [Paperspace](./paperspace.md) - Create an instance directly on Paperspace

Typical needs for Cloud providers (all but SSH):

- **Create your Cloud provider account** - If not already done, you'll need to create an account on the Cloud provider you want to use. 
- **Configure your Cloud provider credentials** - they are required by Cloudy Pad to create your instance.
- **Define Quotas** allowing you to deploy GPU - Most Cloud providers require a "quota increase" before allowing you to deploy GPU instances suitable for Cloud gaming. 
- **Profile verification** - for new accounts, some Cloud provider may require some kind of verification. 

_Note: future version of Cloudy Pad will automate away most of this setup for you._