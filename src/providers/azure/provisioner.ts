import { SshKeyLoader } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from '../../tools/pulumi/azure'
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
    Azure subscription: ${this.args.input.subscriptionId}
    Azure location: ${this.args.input.location}
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.input.ssh.privateKeyPath}
    VM Size: ${this.args.input.vmSize}
    Spot instance: ${this.args.input.useSpot}
    Public IP Type: ${this.args.input.publicIpType}
    Disk type: ${this.args.input.diskType}
    Disk size: ${this.args.input.diskSize}
    Cost Alert: ${this.args.input.costAlert?.limit ? `enabled, limit: ${this.args.input.costAlert.limit}$, ` + 
        `notification email: ${this.args.input.costAlert.notificationEmail}` : 'None.'}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Azure provision aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.input.subscriptionId,
            location: this.args.input.location,
            vmSize: this.args.input.vmSize,
            publicIpType: this.args.input.publicIpType,
            rootDiskSizeGB: this.args.input.diskSize,
            rootDiskType: this.args.input.diskType,
            publicSshKeyContent: new SshKeyLoader().parseSshPrivateKeyFileToPublic(this.args.input.ssh.privateKeyPath),
            useSpot: this.args.input.useSpot,
            costAlert: this.args.input.costAlert ?? undefined,
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

        this.args.output = undefined
        this.args.output = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        await AzureClient.checkAuth()
    }
}
