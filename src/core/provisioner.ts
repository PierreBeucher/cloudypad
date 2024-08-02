import { getLogger, Logger } from "../log/utils"
import { StateManager } from "./state"

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

export class BaseInstanceProvisioner {
    
    readonly sm: StateManager
    protected logger: Logger

    constructor(sm: StateManager){
        this.sm = sm
        this.logger = getLogger(sm.name())
    }
}