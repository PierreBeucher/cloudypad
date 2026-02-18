import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';
import { ServerRunningStatus } from '../../core/runner';
import { DummyInstanceInfraManager } from './infra';
import { INSTANCE_SERVER_STATE_ABSENT, DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT } from '../../core/const';

export interface DummyProvisionerArgs extends InstanceProvisionerArgs<DummyProvisionInputV1, DummyProvisionOutputV1> {
    dummyInfraManager: DummyInstanceInfraManager
}

export class DummyProvisioner extends AbstractInstanceProvisioner<DummyProvisionInputV1, DummyProvisionOutputV1> {

    private readonly dummyInfraManager: DummyInstanceInfraManager

    constructor(args: DummyProvisionerArgs){
        super(args)
        this.dummyInfraManager = args.dummyInfraManager
    }

    /**
     * Data snapshot provision for Dummy provider.
     */
    async doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<DummyProvisionOutputV1> {
        this.logger.info(`Data snapshot provision for Dummy instance ${this.args.instanceName}`)

        if (!this.args.provisionInput.dataDiskSnapshot?.enable) {
            throw new Error(`Data disk snapshot is not enabled for instance ${this.args.instanceName}, this function should not be called. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        if(!this.args.provisionOutput){
            throw new Error(`Provision output is not available for instance ${this.args.instanceName}, this function should not be called. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        // don't run snapshot if there's no data disk ID to snapshot or desired state is set to LIVE
        // If LIVE, snapshot update must NOT be done as disk may be actively in use and creating a snapshot
        // on active disk risks data corruption or plain failure.
        if (!this.args.provisionOutput?.dataDiskId || this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_LIVE) {
            this.logger.debug(`No data disk ID to snapshot, returning current output as-is`)
            return {
                ...(this.args.provisionOutput ?? {}),
                dataDiskSnapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
            }
        }

        this.logger.debug(`Creating data disk snapshot for instance ${this.args.instanceName}`)
        
        // Create new snapshot ID
        const snapshotId = `dummy-snapshot-${this.args.instanceName}-${Date.now()}`
        
        // Update infra state
        await this.dummyInfraManager.setDataDiskSnapshotId(snapshotId)
        
        this.logger.debug(`Data disk snapshot output: ${JSON.stringify({ snapshotId })}`)

        return {
            ...(this.args.provisionOutput ?? {}),
            dataDiskSnapshotId: snapshotId,
            provisionedAt: Date.now(),
        }
    }

    /**
     * Main provision for Dummy provider.
     */
    async doMainProvision(opts?: ProvisionerActionOptions): Promise<DummyProvisionOutputV1> {

        this.logger.info(`Main provision for Dummy instance ${this.args.instanceName}`)

        this.logger.debug(`Main provision Dummy instance with args ${JSON.stringify(this.args)}`)

        // Handle runtime state: instanceServerState
        // Only delete if explicitly set to absent
        if (this.args.provisionInput.runtime?.instanceServerState === INSTANCE_SERVER_STATE_ABSENT) {
            this.logger.info(`Destroying dummy instance server (instanceServerState=absent)`)
            
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Unknown)
            await this.dummyInfraManager.setServerId(undefined)

            // remove data disk is desired data disk state is snapshot
            if(this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_SNAPSHOT){
                await this.dummyInfraManager.setDataDiskId(undefined)
            }
            
            return {
                // re-use output from previous state as much as possible, but main provision updates most of it
                ...(this.args.provisionOutput ?? {}),
                host: `dummy-${this.args.instanceName}`,
                publicIPv4: `127.0.0.1`,
                instanceId: undefined, // Server doesn't exist
                dataDiskId: undefined, // Data disk deleted
                provisionedAt: Date.now(),
            }
        }

        //
        // Instance state is set to present (or undefined, present by default)
        // Simulate provisioning of instance server and data disk
        //

        // unused var, just to check function works
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        // Simulate provisioning delay
        if(this.args.provisionInput.provisioningDelaySeconds && this.args.provisionInput.provisioningDelaySeconds > 0){
            const delay = this.args.provisionInput.provisioningDelaySeconds * 1000
            this.logger.debug(`Emulating provision delay of Dummy instance ${this.args.instanceName}: ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Handle data disk state
        let dataDiskId: string | undefined
        let rootDiskId: string | undefined

        // Create root disk if server is being created
        rootDiskId = `dummy-root-disk-${this.args.instanceName}`
        await this.dummyInfraManager.setRootDiskId(rootDiskId)

        // Create data disk
        dataDiskId = `dummy-data-disk-${this.args.instanceName}`
        await this.dummyInfraManager.setDataDiskId(dataDiskId)

        // Create or update server
        const serverId = `dummy-id-${this.args.instanceName}`
        await this.dummyInfraManager.setServerId(serverId)

        // Use base image ID from input if available, otherwise use output base image ID (created during deploy)
        const baseImageId = this.args.provisionInput?.imageId ?? this.args.provisionOutput?.baseImageId
        if (baseImageId) {
            await this.dummyInfraManager.setBaseImageId(baseImageId)
        }

        this.logger.debug(`Provisioned Dummy instance ${this.args.instanceName}`)

        if(this.args.provisionInput.initialServerStateAfterProvision === undefined || 
            this.args.provisionInput.initialServerStateAfterProvision === "running"
        ){
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
        } else {
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
        }

        return {
            // re-use output from previous state as much as possible, but main provision updates most of it
            ...(this.args.provisionOutput ?? {}),
            host: `dummy-${this.args.instanceName}`,
            publicIPv4: `127.0.0.1`,
            instanceId: serverId,
            rootDiskId: rootDiskId,
            dataDiskId: dataDiskId,
            baseImageId: baseImageId,
            provisionedAt: Date.now(),
        }

    }

    async doBaseImageSnapshotProvision(opts?: ProvisionerActionOptions): Promise<DummyProvisionOutputV1> {
        this.logger.info(`Base image snapshot provision for Dummy instance ${this.args.instanceName}`)

        // Root disk ID is required to create a base image
        if (!this.args.provisionOutput?.rootDiskId) {
            throw new Error(`Root disk ID is required to create base image snapshot for instance ${this.args.instanceName}. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        this.logger.debug(`Creating base image snapshot for instance ${this.args.instanceName}`)
        
        // Create base image ID
        const baseImageId = `dummy-base-image-${this.args.instanceName}-${Date.now()}`
        
        // Update infra state
        await this.dummyInfraManager.setBaseImageId(baseImageId)
        
        this.logger.debug(`Base image snapshot output: ${JSON.stringify({ baseImageId })}`)

        return {
            ...(this.args.provisionOutput ?? {}),
            baseImageId: baseImageId,
        }
    }

    async doDestroy(opts?: ProvisionerActionOptions){
        this.logger.info(`Simulating destruction of dummy instance ${this.args.instanceName}`)
        
        // Destroy base image snapshot if it exists and keepOnDeletion is not enabled
        if (this.args.provisionOutput?.baseImageId && !this.args.provisionInput.baseImageSnapshot?.keepOnDeletion) {
            this.logger.debug(`Destroying base image snapshot ${this.args.provisionOutput.baseImageId}`)
            await this.dummyInfraManager.setBaseImageId(undefined)
        }

        // Clear all infrastructure
        await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Unknown)
        await this.dummyInfraManager.setServerId(undefined)
        await this.dummyInfraManager.setRootDiskId(undefined)
        await this.dummyInfraManager.setDataDiskId(undefined)
        // Note: dataDiskSnapshotId and baseImageId (if keepOnDeletion) are kept for reference
        
        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        this.logger.info(`Verifying dummy instance configuration for ${this.args.instanceName}`)
    }
}
