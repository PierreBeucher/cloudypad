import { SshKeyLoader } from '../../tools/ssh';
import { AwsPulumiClient, PulumiStackConfigAws } from './pulumi/main';
import { AwsDataDiskSnapshotPulumiClient, PulumiStackConfigAwsDataDiskSnapshot } from './pulumi/data-volume-snapshot';
import { AwsBaseImagePulumiClient, PulumiStackConfigAwsBaseImage } from './pulumi/base-image-snapshot';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner';
import { AwsClient } from './sdk-client';
import { AwsProvisionInputV1, AwsProvisionOutputV1 } from './state';
import { DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT } from '../../core/const';

export type AwsProvisionerArgs = InstanceProvisionerArgs<AwsProvisionInputV1, AwsProvisionOutputV1>

export class AwsProvisioner extends AbstractInstanceProvisioner<AwsProvisionInputV1, AwsProvisionOutputV1> {

    constructor(args: AwsProvisionerArgs){
        super(args)
    }

    private buildMainPulumiClient(): AwsPulumiClient {
        const pulumiClient = new AwsPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildDataDiskSnapshotPulumiClient(): AwsDataDiskSnapshotPulumiClient {
        return new AwsDataDiskSnapshotPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
    }

    private buildBaseImagePulumiClient(): AwsBaseImagePulumiClient {
        return new AwsBaseImagePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
    }

    async doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<AwsProvisionOutputV1> {
        this.logger.info(`Data snapshot provision for AWS instance ${this.args.instanceName}`)

        if (!this.args.provisionInput.dataDiskSnapshot?.enable) {
            throw new Error(`Data disk snapshot is not enabled for instance ${this.args.instanceName}, this function should not be called. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        const snapshotClient = this.buildDataDiskSnapshotPulumiClient()

        // don't run Pulumi if there's no data disk ID to snapshot or desired state is set to LIVE
        // If LIVE, snapshot update must NOT be done as disk may be actively in use and creating a snapshot
        // on active disk risks data corruption or plain failure.
        if (!this.args.provisionOutput?.dataDiskId || this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_LIVE) {
            this.logger.debug(`No data disk ID to snapshot, returning current Pulumi output as-is`)

            const currentSnapshotPulumiOutput = await snapshotClient.getOutputs()
            return {
                ...this.getCurrentProvisionOutput(),
                dataDiskSnapshotId: currentSnapshotPulumiOutput?.snapshotId,
            }
        }

        this.logger.debug(`Creating data disk snapshot for instance ${this.args.instanceName}`)
        
        await snapshotClient.setConfig({
            instanceName: this.args.instanceName,
            region: this.args.provisionInput.region,
            // Use full volume ID with vol- prefix
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

    async doMainProvision(opts?: ProvisionerActionOptions): Promise<AwsProvisionOutputV1> {
        this.logger.debug(`Main provision with args ${JSON.stringify(this.args)}`)

        // Build and run main Pulumi stack
        const pulumiClient = this.buildMainPulumiClient()
        const stackConfig = this.buildMainPulumiConfig()
        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return {
            ...this.getCurrentProvisionOutput(),
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
            instanceId: pulumiOutputs.instanceId,
            rootDiskId: pulumiOutputs.rootDiskId,
            dataDiskId: pulumiOutputs.dataDiskId,
            // Raw volume ID is "vol-<id>", we want to return just the <id> for machine lookup
            // It will appear in /dev/disk/by-id/ as vol-{id} on machine
            machineDataDiskLookupId: pulumiOutputs.dataDiskId ? pulumiOutputs.dataDiskId.replace(/^vol-/, '') : undefined,
        }
    }

    async doBaseImageSnapshotProvision(opts?: ProvisionerActionOptions): Promise<AwsProvisionOutputV1> {
        this.logger.info(`Base image snapshot provision for AWS instance ${this.args.instanceName}`)

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
            region: this.args.provisionInput.region,
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
    private getCurrentProvisionOutput(): AwsProvisionOutputV1 {
        return {
            host: this.args.provisionOutput?.host ?? '',
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            instanceId: this.args.provisionOutput?.instanceId ?? '',
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
    private buildMainPulumiConfig(): PulumiStackConfigAws {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        return {
            instanceType: this.args.provisionInput.instanceType,
            publicIpType: this.args.provisionInput.publicIpType,
            region: this.args.provisionInput.region,
            rootVolumeSizeGB: this.args.provisionInput.diskSize,
            publicSshKeyContent: sshPublicKeyContent,
            useSpot: this.args.provisionInput.useSpot,
            billingAlert: this.args.provisionInput.costAlert ?? undefined,
            ingressPorts: this.getStreamingServerPorts(),
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

    async doDestroy(opts?: ProvisionerActionOptions){
        this.logger.debug(`Destroying AWS instance ${this.args.instanceName}`)

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
        const client = new AwsClient(this.args.instanceName, this.args.provisionInput.region)
        await client.checkAuth()
    }
}
