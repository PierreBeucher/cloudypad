import { getLogger, Logger } from "../log/utils"
import { CommonProvisionConfigV1, CommonProvisionOutputV1 } from "./state"

export interface InstanceProvisionOptions  {
    autoApprove?: boolean
    skipAuthCheck?: boolean
}

/**
 * Provision instances: manage Cloud resources and infrastructure
 */
export interface InstanceProvisioner<O extends CommonProvisionOutputV1>  {
    /**
     * Provision the instance: create and update infrastructure and Cloud resources. 
     * @param opts 
     * @returns Outputs after provision
     */
    provision(opts?: InstanceProvisionOptions): Promise<O>

    /**
     * Destroy the instance. Every infrastructure and Cloud resources managed for this instance are destroyed. 
     * @param opts 
     */
    destroy(opts?: InstanceProvisionOptions): Promise<void>
}

export interface InstanceProvisionerArgs<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1> {
    instanceName: string
    config: C
    output?: O
}

export abstract class BaseInstanceProvisioner<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1> implements InstanceProvisioner<O> {
    
    protected logger: Logger
    protected args: InstanceProvisionerArgs<C, O>

    constructor(args: InstanceProvisionerArgs<C, O>){
        this.logger = getLogger(args.instanceName)
        this.args = args
    }
    
    abstract provision(opts?: InstanceProvisionOptions): Promise<O>

    abstract destroy(opts?: InstanceProvisionOptions): Promise<void> 
}