import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner';
import { GcpPulumiClient, PulumiStackConfigGcp } from './pulumi/main';
import { GcpDataDiskSnapshotPulumiClient, PulumiStackConfigGcpDataDiskSnapshot } from './pulumi/data-volume-snapshot';
import { GcpBaseImagePulumiClient, GcpBaseImagePulumiStackConfig } from './pulumi/base-image-snapshot';
import { GcpClient } from './sdk-client';
import { GcpProvisionInputV1, GcpProvisionOutputV1} from './state';
import { NIC_TYPE_AUTO } from './const';
import { DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT } from '../../core/const';

export type GcpProvisionerArgs = InstanceProvisionerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpProvisioner extends AbstractInstanceProvisioner<GcpProvisionInputV1, GcpProvisionOutputV1> {

    constructor(args: GcpProvisionerArgs) {
        super(args)
    }

    private buildMainPulumiClient(): GcpPulumiClient {
        const pulumiClient = new GcpPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildDataDiskSnapshotPulumiClient(): GcpDataDiskSnapshotPulumiClient {
        const pulumiClient = new GcpDataDiskSnapshotPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildBaseImagePulumiClient(): GcpBaseImagePulumiClient {
        const pulumiClient = new GcpBaseImagePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    async doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<GcpProvisionOutputV1> {
        this.logger.info(`Data snapshot provision for GCP instance ${this.args.instanceName}`)

        if (!this.args.provisionInput.dataDiskSnapshot?.enable) {
            throw new Error(`Data disk snapshot is not enabled for instance ${this.args.instanceName}, this function should not be called. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        // don't run Pulumi if there's no data disk ID to snapshot or desired state is set to LIVE
        // If LIVE, snapshot update must NOT be done as disk may be actively in use and creating a snapshot
        // on active disk risks data corruption or plain failure.
        if (!this.args.provisionOutput?.dataDiskId || this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_LIVE) {
            this.logger.debug(`No data disk ID to snapshot, returning current provision output without snapshot`)
            
            // Return current output without trying to access Pulumi stack
            // On initial deploy, there's no data disk yet, so no snapshot to create
            return {
                ...this.getCurrentProvisionOutput(),
                dataDiskSnapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
            }
        }

        this.logger.debug(`Creating data disk snapshot for instance ${this.args.instanceName}`)
        
        const snapshotClient = this.buildDataDiskSnapshotPulumiClient()
        await snapshotClient.setConfig({
            instanceName: this.args.instanceName,
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            baseVolumeId: this.args.provisionOutput.dataDiskId,
        })
        const snapshotOutput = await snapshotClient.up()

        this.logger.debug(`Data disk snapshot output: ${JSON.stringify(snapshotOutput)}`)

        // Return output with snapshot info
        return {
            ...this.getCurrentProvisionOutput(),
            dataDiskSnapshotId: snapshotOutput.snapshotId,
        }
    }

    async doMainProvision(opts?: ProvisionerActionOptions): Promise<GcpProvisionOutputV1> {
        this.logger.info(`Main provision for GCP instance ${this.args.instanceName}`)
        this.logger.debug(`Main provision with args ${JSON.stringify(this.args)}`)

        if(this.args.configurationInput.sunshine?.enable && this.args.provisionInput.acceleratorType == "nvidia-tesla-p4"){
            throw new Error("Sunshine streaming server does not support GCP nvidia-tesla-p4 accelerator type. Please use a different machine type or streaming server.")
        }

        // Build and run main Pulumi stack
        const pulumiClient = this.buildMainPulumiClient()
        const stackConfig = this.buildMainPulumiConfig()
        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return {
            ...this.getCurrentProvisionOutput(),
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
            instanceName: pulumiOutputs.instanceName,
            rootDiskId: pulumiOutputs.rootDiskId ?? undefined,
            dataDiskId: pulumiOutputs.dataDiskId ?? undefined,
            // GCP disks appear in /dev/disk/by-id/ as google-{disk-name}
            // Use disk name for machine lookup
            machineDataDiskLookupId:  pulumiOutputs.dataDiskId ?? undefined,
        }

    }

    async doBaseImageSnapshotProvision(opts?: ProvisionerActionOptions): Promise<GcpProvisionOutputV1> {
        this.logger.info(`Base image snapshot provision for GCP instance ${this.args.instanceName}`)

        // Root disk ID is required to create a base image
        if (!this.args.provisionOutput?.rootDiskId) {
            throw new Error(`Root disk ID is required to create base image snapshot for instance ${this.args.instanceName}. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        this.logger.debug(`Creating base image snapshot for instance ${this.args.instanceName}`)

        const baseImageClient = this.buildBaseImagePulumiClient()
        await baseImageClient.setConfig({
            instanceName: this.args.instanceName,
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            rootVolumeId: this.args.provisionOutput.rootDiskId,
        })
        const imageOutput = await baseImageClient.up()

        this.logger.debug(`Base image snapshot output: ${JSON.stringify(imageOutput)}`)

        return {
            ...this.getCurrentProvisionOutput(),
            baseImageId: imageOutput?.imageId,
        }
    }

    /**
     * Build current output from args, used when no changes are made.
     */
    private getCurrentProvisionOutput(): GcpProvisionOutputV1 {
        return {
            host: this.args.provisionOutput?.host ?? '',
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            instanceName: this.args.provisionOutput?.instanceName ?? '',
            rootDiskId: this.args.provisionOutput?.rootDiskId,
            dataDiskId: this.args.provisionOutput?.dataDiskId,
            baseImageId: this.args.provisionOutput?.baseImageId,
            dataDiskSnapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
            machineDataDiskLookupId: this.args.provisionOutput?.machineDataDiskLookupId,
        }
    }

    /**
     * Build Pulumi config from provision input, including runtime state.
     */
    private buildMainPulumiConfig(): PulumiStackConfigGcp {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        return {
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
            firewallAllowPorts: this.getStreamingServerPorts(),
            instanceServerState: this.args.provisionInput.runtime?.instanceServerState,
            dataDisk: this.args.provisionInput.dataDiskSizeGb ? {
                // only set data disk as absent if desired data disk state is explicitly set to snapshot
                // On main Pulumi stack call, data snapshot would have been done already
                // if undefined or live, data should be present
                state: this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_SNAPSHOT ? "absent" : "present",
                sizeGb: this.args.provisionInput.dataDiskSizeGb,
                // Use data disk snapshot ID if any (for restoration)
                snapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
            } : undefined,
            // use base image ID from input if available, otherwise use output base image ID (created during deploy)
            imageId: this.args.provisionInput?.imageId ?? this.args.provisionOutput?.baseImageId,
        }
    }

    async doDestroy(opts?: ProvisionerActionOptions) {
        this.logger.info(`Destroying GCP instance ${this.args.instanceName}`)

        const pulumiClient = this.buildMainPulumiClient()
        await pulumiClient.destroy({ cancel: opts?.pulumiCancel })

        // Always destroy related stacks even if they are not enabled
        // At worst stack will be created empty then deleted
        await this.doDestroyDataSnapshotStack(opts)

        // Also destroy base image snapshot stack if it exists and keepOnDeletion is not enabled
        if (!this.args.provisionInput.baseImageSnapshot?.keepOnDeletion) {
            await this.doDestroyBaseImageStack(opts)
        }

        this.args.provisionOutput = undefined
    }

    /**
     * Destroy the data disk snapshot Pulumi stack.
     */
    private async doDestroyDataSnapshotStack(opts?: ProvisionerActionOptions): Promise<void> {
        this.logger.info(`Destroying data disk snapshot stack for instance ${this.args.instanceName}`)
        const snapshotClient = this.buildDataDiskSnapshotPulumiClient()
        await snapshotClient.destroy({ cancel: opts?.pulumiCancel })
    }

    /**
     * Destroy the base image snapshot Pulumi stack.
     */
    private async doDestroyBaseImageStack(opts?: ProvisionerActionOptions): Promise<void> {
        this.logger.info(`Destroying base image snapshot stack for instance ${this.args.instanceName}`)
        const baseImageClient = this.buildBaseImagePulumiClient()
        await baseImageClient.destroy({ cancel: opts?.pulumiCancel })
    }

    async doVerifyConfig() {
        const client = new GcpClient(this.args.instanceName, this.args.provisionInput.projectId)
        await client.checkAuth()
    }
}
