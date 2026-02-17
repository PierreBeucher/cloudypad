import { SshKeyLoader } from '../../tools/ssh'
import { AzurePulumiClient, PulumiStackConfigAzure } from './pulumi/main'
import { AzureDataDiskSnapshotPulumiClient } from './pulumi/data-volume-snapshot'
import { AzureBaseImagePulumiClient } from './pulumi/base-image-snapshot'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner'
import { AzureClient } from './sdk-client'
import { AzureProvisionInputV1, AzureProvisionOutputV1 } from './state'
import { DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT } from '../../core/const'

export type AzureProvisionerArgs = InstanceProvisionerArgs<AzureProvisionInputV1, AzureProvisionOutputV1>

export class AzureProvisioner extends AbstractInstanceProvisioner<AzureProvisionInputV1, AzureProvisionOutputV1> {

    constructor(args: AzureProvisionerArgs) {
        super(args)
    }

    private buildMainPulumiClient(): AzurePulumiClient {
        const pulumiClient = new AzurePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildDataDiskSnapshotPulumiClient(): AzureDataDiskSnapshotPulumiClient {
        const pulumiClient = new AzureDataDiskSnapshotPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildBaseImagePulumiClient(): AzureBaseImagePulumiClient {
        const pulumiClient = new AzureBaseImagePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    async doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<AzureProvisionOutputV1> {
        this.logger.info(`Data snapshot provision for Azure instance ${this.args.instanceName}`)

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
            resourceGroupName: this.args.provisionOutput.resourceGroupName,
            location: this.args.provisionInput.location,
            subscriptionId: this.args.provisionInput.subscriptionId,
            baseDiskId: this.args.provisionOutput.dataDiskId,
        })
        const snapshotOutput = await snapshotClient.up()

        this.logger.debug(`Data disk snapshot output: ${JSON.stringify(snapshotOutput)}`)

        // Return output with snapshot info
        return {
            ...this.getCurrentProvisionOutput(),
            dataDiskSnapshotId: snapshotOutput.snapshotId,
        }
    }

    async doMainProvision(opts?: ProvisionerActionOptions): Promise<AzureProvisionOutputV1> {
        this.logger.info(`Main provision for Azure instance ${this.args.instanceName}`)
        this.logger.debug(`Main provision with args ${JSON.stringify(this.args)}`)

        // // If we're deleting both VM and data disk, we need to detach the data disk first
        // // because when instanceServerState is "absent", the VM resource doesn't exist in Pulumi,
        // // so Pulumi can't manage the dependency to delete VM before data disk.
        // // Azure requires data disk to be detached before it can be deleted.
        // const instanceServerState = this.args.provisionInput.runtime?.instanceServerState
        // const dataDiskState = this.args.provisionInput.runtime?.dataDiskState
        // const vmName = this.args.provisionOutput?.vmName
        // const resourceGroupName = this.args.provisionOutput?.resourceGroupName
        // const dataDiskLun = this.args.provisionOutput?.dataDiskLun

        // // THIS MAY NOT BE USEFUL
        // if (instanceServerState === "absent" && 
        //     dataDiskState === DATA_DISK_STATE_SNAPSHOT && 
        //     vmName && 
        //     resourceGroupName && 
        //     dataDiskLun !== undefined) {
        //     this.logger.info(`Detaching data disk from VM before deletion for instance ${this.args.instanceName}`)
        //     try {
        //         const azureClient = new AzureClient(this.args.instanceName, this.args.provisionInput.subscriptionId)
        //         await azureClient.detachDataDisk(resourceGroupName, vmName, dataDiskLun, { wait: true })
        //         this.logger.info(`Successfully detached data disk from VM for instance ${this.args.instanceName}`)
        //     } catch (error) {
        //         // If VM doesn't exist or is already stopped/deleted, detach may fail
        //         // This is OK - Pulumi will handle the deletion
        //         this.logger.warn(`Failed to detach data disk (VM may already be deleted): ${error}`)
        //     }
        // }

        // Build and run main Pulumi stack
        const pulumiClient = this.buildMainPulumiClient()
        const stackConfig = this.buildMainPulumiConfig()
        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return {
            ...this.getCurrentProvisionOutput(),
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
            resourceGroupName: pulumiOutputs.resourceGroupName,
            vmName: pulumiOutputs.vmName,
            rootDiskId: pulumiOutputs.rootDiskId,
            dataDiskId: pulumiOutputs.dataDiskId,
            dataDiskLun: pulumiOutputs.dataDiskLun,
            machineDataDiskLookupId: pulumiOutputs.dataDiskLun !== undefined ? String(pulumiOutputs.dataDiskLun) : undefined,
            machineDataDiskMountMethod: "azure_lun" // always use azure_lun method to mount Azure data disk
        }
    }

    async doBaseImageSnapshotProvision(opts?: ProvisionerActionOptions): Promise<AzureProvisionOutputV1> {
        this.logger.info(`Base image snapshot provision for Azure instance ${this.args.instanceName}`)

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
            resourceGroupName: this.args.provisionOutput.resourceGroupName,
            location: this.args.provisionInput.location,
            subscriptionId: this.args.provisionInput.subscriptionId,
            rootDiskId: this.args.provisionOutput.rootDiskId,
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
    private getCurrentProvisionOutput(): AzureProvisionOutputV1 {
        return {
            host: this.args.provisionOutput?.host ?? '',
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            vmName: this.args.provisionOutput?.vmName,
            resourceGroupName: this.args.provisionOutput?.resourceGroupName ?? '',
            rootDiskId: this.args.provisionOutput?.rootDiskId,
            dataDiskId: this.args.provisionOutput?.dataDiskId,
            baseImageId: this.args.provisionOutput?.baseImageId,
            dataDiskSnapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
            dataDiskLun: this.args.provisionOutput?.dataDiskLun,
            machineDataDiskLookupId: this.args.provisionOutput?.machineDataDiskLookupId,
            machineDataDiskMountMethod: this.args.provisionOutput?.machineDataDiskMountMethod,
        }
    }

    /**
     * Build Pulumi config from provision input, including runtime state.
     */
    private buildMainPulumiConfig(): PulumiStackConfigAzure {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        return {
            subscriptionId: this.args.provisionInput.subscriptionId,
            location: this.args.provisionInput.location,
            vmSize: this.args.provisionInput.vmSize,
            publicIpType: this.args.provisionInput.publicIpType,
            rootDiskSizeGB: this.args.provisionInput.diskSize,
            rootDiskType: this.args.provisionInput.diskType,
            publicSshKeyContent: sshPublicKeyContent,
            useSpot: this.args.provisionInput.useSpot,
            costAlert: this.args.provisionInput.costAlert ?? undefined,
            securityGroupPorts: this.getStreamingServerPorts(),
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
        this.logger.info(`Destroying Azure instance ${this.args.instanceName}`)

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
        await AzureClient.checkAuth()
    }
}
