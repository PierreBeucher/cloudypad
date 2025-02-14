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

        this.logger.debug(`Provisioning Azure instance with args ${JSON.stringify(this.args)} and options ${JSON.stringify(opts)}`)

        let confirmCreation: boolean
        if (opts?.autoApprove) {
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `You are about to provision Azure machine with the following details:\n` + 
                `    ${this.inputToHumanReadableString(this.args)}` +
                `\nDo you want to proceed?`,
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
            securityGroupPorts: this.getStreamingServerPorts()
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
