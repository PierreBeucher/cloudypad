import { SshKeyLoader } from '../../tools/ssh'
import { ScalewayPulumiClient, PulumiStackConfigScaleway } from './pulumi'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'
import { ScalewayClient } from '../../tools/scaleway'

export type ScalewayProvisionerArgs = InstanceProvisionerArgs<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>

export class ScalewayProvisioner extends AbstractInstanceProvisioner<ScalewayProvisionInputV1, ScalewayProvisionOutputV1> {

    constructor(args: ScalewayProvisionerArgs) {
        super(args)
    }

    async doProvision() {

        this.logger.info(`Provisioning Scaleway instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Scaleway instance with args ${JSON.stringify(this.args)}`)

        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        const pulumiClient = new ScalewayPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })

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

        return {
            host: pulumiOutputs.publicIp,
            instanceName: pulumiOutputs.instanceName,
            instanceServerId: pulumiOutputs.instanceServerId,
            dataDiskId: pulumiOutputs.dataDiskId,
            rootDiskId: pulumiOutputs.rootDiskId,
        }

    }

    async doDestroy() {

        const pulumiClient = new ScalewayPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        await pulumiClient.destroy()

        this.args.provisionOutput = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        ScalewayClient.checkLocalConfig()
    }
}
