import { SshKeyLoader } from '../../tools/ssh'
import { ScalewayPulumiClient, PulumiStackConfigScaleway } from './pulumi/main'
import { ScalewayDataDiskSnapshotPulumiClient} from './pulumi/data-volume-snapshot'
import { ScalewayBaseImagePulumiClient } from './pulumi/base-image-snapshot'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'
import { ScalewayClient } from './sdk-client'
import { DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT } from '../../core/const'

export type ScalewayProvisionerArgs = InstanceProvisionerArgs<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>

export class ScalewayProvisioner extends AbstractInstanceProvisioner<ScalewayProvisionInputV1, ScalewayProvisionOutputV1> {

    constructor(args: ScalewayProvisionerArgs) {
        super(args)
    }

    private buildMainPulumiClient(): ScalewayPulumiClient {
        const pulumiClient = new ScalewayPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildDataDiskSnapshotPulumiClient(): ScalewayDataDiskSnapshotPulumiClient {
        const pulumiClient = new ScalewayDataDiskSnapshotPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildBaseImagePulumiClient(): ScalewayBaseImagePulumiClient {
        const pulumiClient = new ScalewayBaseImagePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    async doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<ScalewayProvisionOutputV1> {
        this.logger.info(`Data snapshot provision for Scaleway instance ${this.args.instanceName}`)

        // If data disk snapshot feature is not enabled, return current output as-is
        if (!this.args.provisionInput.dataDiskSnapshot?.enable) {
            throw new Error(`Data disk snapshot is not enabled for instance ${this.args.instanceName}, this function should not be called. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        const snapshotClient = this.buildDataDiskSnapshotPulumiClient()

        // don't run Pulumi if there's no data disk ID to snapshot
        // or desired state is set to LIVE (in which case snapshot update is not needed)
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
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            // may be undefined, in which case simply no-op and will have undefined snapshot ID in output
            baseVolumeId: this.args.provisionOutput?.dataDiskId,
        })
        const snapshotOutput = await snapshotClient.up()

        this.logger.debug(`Data disk snapshot output: ${JSON.stringify(snapshotOutput)}`)

        // Return output with snapshot info
        return {
            ...this.getCurrentProvisionOutput(),
            dataDiskSnapshotId: snapshotOutput.snapshotId,
        }
    }

    async doMainProvision(opts?: ProvisionerActionOptions): Promise<ScalewayProvisionOutputV1> {
        this.logger.info(`Main provision for Scaleway instance ${this.args.instanceName}`)
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
            instanceServerName: pulumiOutputs.instanceServerName ?? undefined,
            instanceServerId: pulumiOutputs.instanceServerId ?? undefined,
            dataDiskId: pulumiOutputs.dataDiskId ?? undefined,
            rootDiskId: pulumiOutputs.rootDiskId ?? undefined,
        }

    }

    async doBaseImageSnapshotProvision(opts?: ProvisionerActionOptions): Promise<ScalewayProvisionOutputV1> {
        this.logger.info(`Base image snapshot provision for Scaleway instance ${this.args.instanceName}`)

        // If imageId is set in input, use it directly as passthrough (user provides their own image)
        if (this.args.provisionInput.imageId) {
            this.logger.debug(`Using provided imageId as baseImageId passthrough: ${this.args.provisionInput.imageId}`)
            return {
                ...this.getCurrentProvisionOutput(),
                baseImageId: this.args.provisionInput.imageId,
            }
        }

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
    private getCurrentProvisionOutput(): ScalewayProvisionOutputV1 {
        return {
            host: this.args.provisionOutput?.host ?? '',
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            instanceServerName: this.args.provisionOutput?.instanceServerName,
            instanceServerId: this.args.provisionOutput?.instanceServerId,
            dataDiskId: this.args.provisionOutput?.dataDiskId,
            rootDiskId: this.args.provisionOutput?.rootDiskId,
            baseImageId: this.args.provisionOutput?.baseImageId,
            dataDiskSnapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
        }
    }

    /**
     * Build Pulumi config from provision input, including runtime state.
     */
    private buildMainPulumiConfig(): PulumiStackConfigScaleway {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        return {
            instanceName: this.args.instanceName,
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            instanceType: this.args.provisionInput.instanceType,
            instanceServerState: this.args.provisionInput.runtime?.instanceServerState,
            rootDisk: {
                sizeGb: this.args.provisionInput.diskSizeGb,
            },
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
            securityGroupPorts: this.getStreamingServerPorts(),
            publicKeyContent: sshPublicKeyContent,
        }
    }

    async doDestroy(opts?: ProvisionerActionOptions) {
        this.logger.info(`Destroying Scaleway instance ${this.args.instanceName}`)

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

    protected async doVerifyConfig(): Promise<void> {
        ScalewayClient.checkLocalConfig()
    }

}
