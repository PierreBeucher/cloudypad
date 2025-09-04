import { SshKeyLoader } from '../../tools/ssh'
import { ScalewayPulumiClient, PulumiStackConfigScaleway, ScalewayPulumiOutput } from './pulumi'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'
import { ScalewayClient } from './sdk-client'

export type ScalewayProvisionerArgs = InstanceProvisionerArgs<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>

export class ScalewayProvisioner extends AbstractInstanceProvisioner<ScalewayProvisionInputV1, ScalewayProvisionOutputV1> {

    constructor(args: ScalewayProvisionerArgs) {
        super(args)
    }

    private buildPulumiClient(): ScalewayPulumiClient {
        const pulumiClient = new ScalewayPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    /**
     * Destroy the instance server by running Pulumi stack up with specific configs
     * to remove instance server
     */
    async destroyInstanceServer(): Promise<ScalewayProvisionOutputV1> {

        this.logger.info(`Destroying instance server for ${this.args.instanceName}`)

        const pulumiClient = this.buildPulumiClient()
        const stackConfig = this.buildPulumiConfig({ noInstanceServer: true })
        await pulumiClient.setConfig(stackConfig)
        await pulumiClient.up()

        const newOutputs = await pulumiClient.getOutputs()

        this.logger.debug(`New outputs after destroying instance server: ${JSON.stringify(newOutputs)}`)

        return this.pulumiOutputsToProvisionOutput(newOutputs)
    }

    async doProvision(): Promise<ScalewayProvisionOutputV1> {

        this.logger.info(`Provisioning Scaleway instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Scaleway instance ${this.args.instanceName} with args ${JSON.stringify(this.args)}`)


        const pulumiClient = this.buildPulumiClient()
        const stackConfig = this.buildPulumiConfig()

        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up()

        return this.pulumiOutputsToProvisionOutput(pulumiOutputs)

    }

    private buildPulumiConfig(args?: { noInstanceServer?: boolean }): PulumiStackConfigScaleway {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        return {
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            instanceType: this.args.provisionInput.instanceType,
            rootDisk: {
                sizeGb: this.args.provisionInput.diskSizeGb,
            },
            dataDisk: this.args.provisionInput.dataDiskSizeGb ? {
                sizeGb: this.args.provisionInput.dataDiskSizeGb,
            } : undefined,
            imageId: this.args.provisionInput.imageId,
            securityGroupPorts: this.getStreamingServerPorts(),
            publicKeyContent: sshPublicKeyContent,
            noInstanceServer: args?.noInstanceServer,
        }
    }

    private pulumiOutputsToProvisionOutput(pulumiOutputs: ScalewayPulumiOutput): ScalewayProvisionOutputV1 {
        return {
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
            instanceServerName: pulumiOutputs.instanceServerName ?? undefined,
            instanceServerId: pulumiOutputs.instanceServerId ?? undefined,
            dataDiskId: pulumiOutputs.dataDiskId ?? undefined,
            rootDiskId: pulumiOutputs.rootDiskId ?? undefined,
        }
    }

    async doDestroy() {

        const pulumiClient = this.buildPulumiClient()
        await pulumiClient.destroy()

        this.args.provisionOutput = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        ScalewayClient.checkLocalConfig()
    }
}
