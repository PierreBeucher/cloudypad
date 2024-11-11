import { getLogger, Logger } from "../log/utils"

export interface InstanceProvisionOptions  {
    autoApprove?: boolean
    skipAuthCheck?: boolean
}

/**
 * Provision instance Cloud resources. 
 */
export interface InstanceProvisioner {
    provision(opts?: InstanceProvisionOptions): Promise<void>

    destroy(opts?: InstanceProvisionOptions): Promise<void>
}

export interface BaseInstanceProvisionerArgs {
    instanceName: string
}

export class BaseInstanceProvisioner {
    
    protected logger: Logger

    constructor(args: BaseInstanceProvisionerArgs){
        this.logger = getLogger(args.instanceName)
    }
}