import { SshKeyLoader } from '../../tools/ssh'
import { AzurePulumiClient, PulumiStackConfigAzure } from './pulumi'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner'
import { AzureClient } from './sdk-client'
import { AzureProvisionInputV1, AzureProvisionOutputV1 } from './state'

export type AzureProvisionerArgs = InstanceProvisionerArgs<AzureProvisionInputV1, AzureProvisionOutputV1>

export class AzureProvisioner extends AbstractInstanceProvisioner<AzureProvisionInputV1, AzureProvisionOutputV1> {

    constructor(args: AzureProvisionerArgs) {
        super(args)
    }

    async doProvision(opts?: ProvisionerActionOptions) {

        this.logger.info(`Provisioning Azure instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Azure instance with args ${JSON.stringify(this.args)}`)

        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)
        const pulumiClient = new AzurePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.provisionInput.subscriptionId,
            location: this.args.provisionInput.location,
            vmSize: this.args.provisionInput.vmSize,
            publicIpType: this.args.provisionInput.publicIpType,
            rootDiskSizeGB: this.args.provisionInput.diskSize,
            rootDiskType: this.args.provisionInput.diskType,
            publicSshKeyContent: sshPublicKeyContent,
            useSpot: this.args.provisionInput.useSpot,
            costAlert: this.args.provisionInput.costAlert ?? undefined,
            securityGroupPorts: this.getStreamingServerPorts()
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return {
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
            resourceGroupName: pulumiOutputs.resourceGroupName,
            vmName: pulumiOutputs.vmName,
        }

    }

    async doDestroy(opts?: ProvisionerActionOptions) {

        const pulumiClient = new AzurePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        await pulumiClient.destroy({ cancel: opts?.pulumiCancel })

        this.args.provisionOutput = undefined
        this.args.provisionOutput = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        await AzureClient.checkAuth()
    }
}
