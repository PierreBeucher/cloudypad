import { SshKeyLoader } from '../../tools/ssh'
import { ScalewayPulumiClient, PulumiStackConfigScaleway, ScalewayPulumiOutput } from './pulumi'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'
import { ScalewayClient } from '../../tools/scaleway'

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

    async destroyInstanceServer(): Promise<ScalewayProvisionOutputV1> {

        this.logger.info(`Destroying instance server for ${this.args.instanceName}`)

        const pulumiClient = this.buildPulumiClient()
        const previousOutputs = await pulumiClient.getOutputs()
        const instanceServerUrn = previousOutputs.instanceServerUrn

        if(!instanceServerUrn){
            this.logger.info(`Instance server URN not found for instance ${this.args.instanceName}. No need to delete instance server.`)
            return this.pulumiOutputsToProvisionOutput(previousOutputs)
        }

        this.logger.info(`Deleting instance server ${instanceServerUrn} for instance ${this.args.instanceName}`)

        const newOutputs = await pulumiClient.destroyResources([instanceServerUrn])

        this.logger.debug(`New outputs after destroying instance server: ${JSON.stringify(newOutputs)}`)

        return this.pulumiOutputsToProvisionOutput(newOutputs)
        
    }

    async doProvision(): Promise<ScalewayProvisionOutputV1> {

        this.logger.info(`Provisioning Scaleway instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Scaleway instance ${this.args.instanceName} with args ${JSON.stringify(this.args)}`)

        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        const pulumiClient = this.buildPulumiClient()

        const pulumiConfig: PulumiStackConfigScaleway = {
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
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return this.pulumiOutputsToProvisionOutput(pulumiOutputs)

    }

    private pulumiOutputsToProvisionOutput(pulumiOutputs: ScalewayPulumiOutput): ScalewayProvisionOutputV1 {
        return {
            host: pulumiOutputs.publicIp,
            instanceName: pulumiOutputs.instanceName,
            instanceServerId: pulumiOutputs.instanceServerId,
            dataDiskId: pulumiOutputs.dataDiskId,
            rootDiskId: pulumiOutputs.rootDiskId,
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
