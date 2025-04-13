import { SshKeyLoader } from '../../tools/ssh'
import { ScalewayPulumiClient, PulumiStackConfigScaleway } from './pulumi'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'
import { ScalewayClient } from '../../tools/scaleway'

export type ScalewayProvisionerArgs = InstanceProvisionerArgs<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>

export class ScalewayProvisioner extends AbstractInstanceProvisioner<ScalewayProvisionInputV1, ScalewayProvisionOutputV1> {

    constructor(args: ScalewayProvisionerArgs) {
        super(args)
    }

    async doProvision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Scaleway instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Scaleway instance with args ${JSON.stringify(this.args)} and options ${JSON.stringify(opts)}`)

        const pulumiClient = new ScalewayPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigScaleway = {
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            instanceType: this.args.provisionInput.instanceType,
            rootDisk: {
                sizeGb: this.args.provisionInput.diskSizeGb,
                type: "b_ssd"
            },
            // Scaleway was initially implemented with data disk support in mind
            // Was finally undone as it would require a lot of changes to the codebase to support legacy mode and data disk mode
            additionalVolumes: [],
            imageId: this.args.provisionInput.imageId,
            securityGroupPorts: this.getStreamingServerPorts(),
            publicKeyContent: new SshKeyLoader().parseSshPrivateKeyFileToPublic(this.args.provisionInput.ssh.privateKeyPath),
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            host: pulumiOutputs.publicIp,
            instanceName: pulumiOutputs.instanceName,
            instanceServerId: pulumiOutputs.instanceServerId,
        }

    }

    async doDestroy() {

        const pulumiClient = new ScalewayPulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.provisionOutput = undefined
    }

    protected async doVerifyConfig(): Promise<void> {
        ScalewayClient.checkLocalConfig()
    }
}
