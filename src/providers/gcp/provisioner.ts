import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner';
import { GcpPulumiClient, PulumiStackConfigGcp } from './pulumi';
import { GcpClient } from './sdk-client';
import { GcpProvisionInputV1, GcpProvisionOutputV1} from './state';
import { NIC_TYPE_AUTO } from './const';

export type GcpProvisionerArgs = InstanceProvisionerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpProvisioner extends AbstractInstanceProvisioner<GcpProvisionInputV1, GcpProvisionOutputV1> {

    constructor(args: GcpProvisionerArgs) {
        super(args)
    }

    async doProvision(opts?: ProvisionerActionOptions) {

        this.logger.info(`Provisioning Google Cloud instance ${this.args.instanceName}`)

        await this.verifyConfig()

        this.logger.debug(`Provisioning Google Cloud instance with ${JSON.stringify(this.args)}`)

        if(this.args.configurationInput.sunshine?.enable && this.args.provisionInput.acceleratorType == "nvidia-tesla-p4"){
            throw new Error("Sunshine streaming server does not support GCP nvidia-tesla-p4 accelerator type. Please use a different machine type or streaming server.")
        }

        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        const pulumiClient = new GcpPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })

        const pulumiConfig: PulumiStackConfigGcp = {
            machineType: this.args.provisionInput.machineType,
            acceleratorType: this.args.provisionInput.acceleratorType,
            projectId: this.args.provisionInput.projectId,
            publicIpType: this.args.provisionInput.publicIpType,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            rootDiskSize: this.args.provisionInput.diskSize,
            // diskType: pd-standard (cheapest, slowest), pd-balanced (good compromise), pd-ssd (best performance, highest cost)
            // See: https://cloud.google.com/compute/docs/disks#disk-types
            diskType: this.args.provisionInput.diskType, // User selects: pd-standard, pd-balanced, pd-ssd
            // networkTier: STANDARD (cheaper, higher latency), PREMIUM (better, lower latency, more expensive)
            // See: https://cloud.google.com/network-tiers/docs/overview
            networkTier: this.args.provisionInput.networkTier, // User selects: STANDARD, PREMIUM
            // nicType: undefined (auto, let GCP choose), GVNIC (best performance, lowest latency, only supported on some machine types), VIRTIO_NET (legacy, compatible)
            // See: https://cloud.google.com/compute/docs/network-interfaces#nic-types
            // Default is undefined (auto), which lets GCP select the best available NIC type.
            // If user selects 'auto', map to undefined so GCP auto-selects NIC type.
            nicType: this.args.provisionInput.nicType === NIC_TYPE_AUTO ? undefined : this.args.provisionInput.nicType,
            publicSshKeyContent: sshPublicKeyContent,
            useSpot: this.args.provisionInput.useSpot,
            costAlert: this.args.provisionInput.costAlert ?? undefined,
            firewallAllowPorts: this.getStreamingServerPorts()
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return {
            instanceName: pulumiOutputs.instanceName,
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
        }

    }

    async doDestroy(opts?: ProvisionerActionOptions){
        const pulumiClient = new GcpPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        await pulumiClient.destroy({ cancel: opts?.pulumiCancel })

        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        const client = new GcpClient(this.args.instanceName, this.args.provisionInput.projectId)
        await client.checkAuth()
    }
}
