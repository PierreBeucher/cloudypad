import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner';
import { GcpPulumiClient, PulumiStackConfigGcp } from './pulumi';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionInputV1, GcpProvisionOutputV1} from './state';

export type GcpProvisionerArgs = InstanceProvisionerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpProvisioner extends AbstractInstanceProvisioner<GcpProvisionInputV1, GcpProvisionOutputV1> {

    constructor(args: GcpProvisionerArgs) {
        super(args)
    }

    async doProvision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Google Cloud instance ${this.args.instanceName}`)

        await this.verifyConfig()

        this.logger.debug(`Provisioning Google Cloud instance with ${JSON.stringify(this.args)} and options ${JSON.stringify(opts)}`)

        if(this.args.configurationInput.sunshine?.enable && this.args.provisionInput.acceleratorType == "nvidia-tesla-p4"){
            throw new Error("Sunshine streaming server does not support GCP nvidia-tesla-p4 accelerator type. Please use a different machine type or streaming server.")
        }

        const pulumiClient = new GcpPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigGcp = {
            machineType: this.args.provisionInput.machineType,
            acceleratorType: this.args.provisionInput.acceleratorType,
            projectId: this.args.provisionInput.projectId,
            publicIpType: this.args.provisionInput.publicIpType,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            rootDiskSize: this.args.provisionInput.diskSize,
            publicSshKeyContent: new SshKeyLoader().parseSshPrivateKeyFileToPublic(this.args.provisionInput.ssh.privateKeyPath),
            useSpot: this.args.provisionInput.useSpot,
            costAlert: this.args.provisionInput.costAlert ?? undefined,
            firewallAllowPorts: this.getStreamingServerPorts()
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            instanceName: pulumiOutputs.instanceName,
            host: pulumiOutputs.publicIp
        }

    }

    async doDestroy(){
        const pulumiClient = new GcpPulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        const client = new GcpClient(this.args.instanceName, this.args.provisionInput.projectId)
        await client.checkAuth()
    }
}
