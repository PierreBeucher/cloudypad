import { getLogger, Logger } from "../log/utils"
import { CLOUDYPAD_SUNSHINE_PORTS, CLOUDYPAD_WOLF_PORTS, SimplePortDefinition } from "./const"
import { CommonProvisionInputV1, CommonProvisionOutputV1, CommonConfigurationInputV1 } from "./state/state"

export interface InstanceProvisionOptions  {

}

export interface DestroyOptions {

}

/**
 * Provision instances: manage Cloud resources and infrastructure
 */
export interface InstanceProvisioner  {

    /**
     * Verify local provider config is valid to run other operations.
     * Throw an exception if config is invalid. 
     */
    verifyConfig(): Promise<void>

    /**
     * Provision the instance: create and update infrastructure and Cloud resources. 
     * @param opts 
     * @returns Outputs after provision
     */
    provision(opts?: InstanceProvisionOptions): Promise<CommonProvisionOutputV1>

    /**
     * Destroy the instance. Every infrastructure and Cloud resources managed for this instance are destroyed. 
     * @param opts 
     */
    destroy(opts?: DestroyOptions): Promise<void>
}

export interface InstanceProvisionerArgs<PC extends CommonProvisionInputV1, PO extends CommonProvisionOutputV1> {
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

    async provision(opts?: InstanceProvisionOptions): Promise<PO> {
        this.logger.info(`Provisioning instance ${this.args.instanceName}`)
        return await this.doProvision(opts)
    }

    async destroy(opts?: DestroyOptions): Promise<void> {
        this.logger.info(`Destroying instance ${this.args.instanceName}...`)
        
        await this.doDestroy()

        this.logger.info(`Destroyed instance ${this.args.instanceName}`)
    }

    protected abstract doVerifyConfig(): Promise<void>;
    protected abstract doProvision(opts?: InstanceProvisionOptions): Promise<PO>;
    protected abstract doDestroy(): Promise<void>;

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