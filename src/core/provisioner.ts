import { getLogger, Logger } from "../log/utils"
import { StateManager } from "./state"

/**
 * Provision instance Cloud resources. 
 */
export interface InstanceProvisioner {
    provision(): Promise<void>

    destroy(): Promise<void>
}

export class BaseInstanceProvisioner {
    
    readonly sm: StateManager
    protected logger: Logger

    constructor(sm: StateManager){
        this.sm = sm
        this.logger = getLogger(sm.name())
    }
}