import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from '../../tools/pulumi/azure'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionConfigV1, AzureProvisionOutputV1 } from './state'

export type AzureProvisionerArgs = InstanceProvisionerArgs<AzureProvisionConfigV1, AzureProvisionOutputV1>

export class AzureProvisioner extends AbstractInstanceProvisioner<AzureProvisionConfigV1, AzureProvisionOutputV1> {

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
    Azure subscription: ${this.args.config.subscriptionId}
    Azure location: ${this.args.config.location}
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.config.ssh.privateKeyPath}
    VM Size: ${this.args.config.vmSize}
    Spot instance: ${this.args.config.useSpot}
    Public IP Type: ${this.args.config.publicIpType}
    Disk size: ${this.args.config.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Azure provision aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.config.subscriptionId,
            location: this.args.config.location,
            vmSize: this.args.config.vmSize,
            publicIpType: this.args.config.publicIpType,
            rootDiskSizeGB: this.args.config.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.config.ssh.privateKeyPath),
            useSpot: this.args.config.useSpot,
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

        this.logger.info(`Destroying instance: ${this.args.instanceName}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy Azure instance '${this.args.instanceName}'. Please confirm:`,
            default: false,
        })

        if (!confirmCreation) {
            throw new Error('Destroy aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.output = undefined
        this.args.output = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        await AzureClient.checkAuth()
    }
}
