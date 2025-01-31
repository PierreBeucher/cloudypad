import { SshKeyLoader } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from './pulumi'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionInputV1, AzureProvisionOutputV1 } from './state'

export type AzureProvisionerArgs = InstanceProvisionerArgs<AzureProvisionInputV1, AzureProvisionOutputV1>

export class AzureProvisioner extends AbstractInstanceProvisioner<AzureProvisionInputV1, AzureProvisionOutputV1> {

    constructor(args: AzureProvisionerArgs) {
        super(args)
    }

    async doProvision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Azure instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Azure instance ${JSON.stringify(this.args)}`)

        let confirmCreation: boolean
        if (opts?.autoApprove) {
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Azure machine with the following details:
    Azure subscription: ${this.args.provisionInput.subscriptionId}
    Azure location: ${this.args.provisionInput.location}
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.provisionInput.ssh.privateKeyPath}
    VM Size: ${this.args.provisionInput.vmSize}
    Spot instance: ${this.args.provisionInput.useSpot}
    Public IP Type: ${this.args.provisionInput.publicIpType}
    Disk type: ${this.args.provisionInput.diskType}
    Disk size: ${this.args.provisionInput.diskSize}
    Cost Alert: ${this.args.provisionInput.costAlert?.limit ? `enabled, limit: ${this.args.provisionInput.costAlert.limit}$, ` + 
        `notification email: ${this.args.provisionInput.costAlert.notificationEmail}` : 'None.'}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Azure provision aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.provisionInput.subscriptionId,
            location: this.args.provisionInput.location,
            vmSize: this.args.provisionInput.vmSize,
            publicIpType: this.args.provisionInput.publicIpType,
            rootDiskSizeGB: this.args.provisionInput.diskSize,
            rootDiskType: this.args.provisionInput.diskType,
            publicSshKeyContent: new SshKeyLoader().parseSshPrivateKeyFileToPublic(this.args.provisionInput.ssh.privateKeyPath),
            useSpot: this.args.provisionInput.useSpot,
            costAlert: this.args.provisionInput.costAlert ?? undefined,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            host: pulumiOutputs.publicIp,
            resourceGroupName: pulumiOutputs.resourceGroupName,
            vmName: pulumiOutputs.vmName,
        }

    }

    async doDestroy() {

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.provisionOutput = undefined
        this.args.provisionOutput = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        await AzureClient.checkAuth()
    }
}
