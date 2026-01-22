import { getLogger, Logger } from "../log/utils"
import { CLOUDYPAD_SUNSHINE_PORTS, CLOUDYPAD_WOLF_PORTS, SimplePortDefinition } from "./const"
import { CommonProvisionInputV1, CommonProvisionOutputV1, CommonConfigurationInputV1 } from "./state/state"
import { CoreConfig } from "./config/interface"

/**
 * Options for provisioner actions
 */
export interface ProvisionerActionOptions {
    /**
     * Cancel any stuck Pulumi operations before running the action. Default: false
     */
    pulumiCancel?: boolean
}

/**
 * Provision instances: manage Cloud resources and infrastructure.
 * 
 * Provisioner has two main provisioning methods called by manager:
 * - dataSnapshotProvision: manages data disk snapshot stack (create/delete snapshot)
 * - mainProvision: manages main infrastructure stack (server, disks, network)
 * 
 * Manager calls these in sequence:
 * 1. dataSnapshotProvision - updates snapshot state based on runtime flags
 * 2. mainProvision - updates main infrastructure based on runtime flags and snapshot output
 * 
 * Runtime flags in provision input control behavior:
 * - enableInstanceServer: if true, server exists; if false, server is deleted
 * - dataDiskState: "live" = disk exists, "snapshot" = snapshot exists (disk deleted)
 */
export interface InstanceProvisioner  {

    /**
     * Verify local provider config is valid to run other operations.
     * Throw an exception if config is invalid. 
     */
    verifyConfig(): Promise<void>

    /**
     * Provision data disk snapshot stack.
     * 
     * Manages snapshot lifecycle based on runtime.dataDiskState:
     * - "snapshot": create snapshot from existing data disk (if disk exists)
     * - "live": no action on snapshot (will be destroyed when restoring disk)
     * 
     * @param opts 
     * @returns Partial outputs with snapshot info
     */
    dataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<CommonProvisionOutputV1>

    /**
     * Provision main infrastructure stack.
     * 
     * Manages main resources based on runtime flags:
     * - enableInstanceServer: create/destroy server
     * - dataDiskState: create/destroy data disk, restore from snapshot if available
     * 
     * @param opts 
     * @returns Full provision outputs
     */
    mainProvision(opts?: ProvisionerActionOptions): Promise<CommonProvisionOutputV1>

    /**
     * Destroy the instance. Every infrastructure and Cloud resources managed for this instance are destroyed. 
     * @param opts 
     */
    destroy(opts?: ProvisionerActionOptions): Promise<void>
}

export interface InstanceProvisionerArgs<PC extends CommonProvisionInputV1, PO extends CommonProvisionOutputV1> {
    coreConfig: CoreConfig
    instanceName: string
    provisionInput: PC
    provisionOutput?: PO
    configurationInput: CommonConfigurationInputV1
}

export abstract class AbstractInstanceProvisioner<PC extends CommonProvisionInputV1, PO extends CommonProvisionOutputV1> implements InstanceProvisioner {
    
    protected logger: Logger
    protected args: InstanceProvisionerArgs<PC, PO>

    constructor(args: InstanceProvisionerArgs<PC, PO>){
        this.logger = getLogger(args.instanceName)
        this.args = args
    }

    async verifyConfig(): Promise<void> {
        this.logger.info(`Verifying configuration for instance ${this.args.instanceName}`);
        await this.doVerifyConfig();
    }

    async dataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<PO> {
        this.logger.info(`Data snapshot provision for instance ${this.args.instanceName}`)
        
        const input = this.args.provisionInput
        this.logger.debug(`Data snapshot provision with current args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`)
        
        return await this.doDataSnapshotProvision(opts)
    }

    async mainProvision(opts?: ProvisionerActionOptions): Promise<PO> {
        this.logger.info(`Main provision for instance ${this.args.instanceName}`)
        
        const input = this.args.provisionInput
        this.logger.debug(`Main provision with current args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`)
        
        return await this.doMainProvision(opts)
    }

    async destroy(opts?: ProvisionerActionOptions): Promise<void> {
        this.logger.info(`Destroying instance ${this.args.instanceName}...`)
        
        await this.doDestroy(opts)

        this.logger.info(`Destroyed instance ${this.args.instanceName}`)
    }

    /**
     * Data snapshot provision. Depending on State provision inputs:
     * - If dataDiskState is DATA_DISK_STATE_SNAPSHOT: create a snapshot from existing data disk if any.
     *   When DATA_DISK_STATE_SNAPSHOT but no live data disk exists, no-op: this is expected
     *   on instance initial deployment or if stopped when already stopped. 
     *   Created or existing data disk snapshot is returned in output. It may be undefined if no snapshot was created
     *   event if DATA_DISK_STATE_SNAPSHOT is set. 
     */
    protected doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<PO> {
        // by default data snapshot is not supported, keep this until it's globally supported and become the default 
        // or no-op without error
        throw new Error(`Data snapshot provision not implemented for instance ${this.args.instanceName}`)
    }

    /**
     * Main provision to deploy instance server, public IP, disks, network, etc.
     * Depending on inputs can be used to initially deploy, start or stop instance
     * - Initial deployment: inputs would set enableInstanceServer=true and dataDiskState=DATA_DISK_STATE_LIVE
     * - Start instance: inputs would set enableInstanceServer=true and dataDiskState=DATA_DISK_STATE_LIVE
     * - Stop instance: inputs would set enableInstanceServer=false and dataDiskState=DATA_DISK_STATE_SNAPSHOT
     * 
     * This behavior may be adapted based on specific provider needs, but should be consistent across all providers
     * as provision may be part of the instance start/stop flow. It's possible some providers treat provision as no-op,
     * eg the ssh or local provider.
     */
    protected abstract doMainProvision(opts?: ProvisionerActionOptions): Promise<PO>;

    protected abstract doVerifyConfig(): Promise<void>;
    protected abstract doDestroy(opts?: ProvisionerActionOptions): Promise<void>;

    /**
     * Return ports to expose on this instance for its current streaming server
     */
    protected getStreamingServerPorts(): SimplePortDefinition[] {
        if (this.args.configurationInput.sunshine?.enable) {
            return CLOUDYPAD_SUNSHINE_PORTS
        } else if (this.args.configurationInput.wolf?.enable) {
            return CLOUDYPAD_WOLF_PORTS
        } else {
            throw new Error(`Can't define ports to expose for instance ${this.args.instanceName}: unknown streaming server. This is probably a bug.`)
        }
    }

}

/**
 * Generic options for cost alert used by providers supporting automated cost alert setup.
 */
export interface CostAlertOptions {

    /**
     * Cost alert limit (USD).
     */
    limit: number

    /**
     * Cost alert notification email.
     */
    notificationEmail: string
}