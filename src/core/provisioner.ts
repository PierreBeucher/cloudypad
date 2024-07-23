import { getLogger, Logger } from "../log/utils"
import { StateManager } from "./state"

/**
 * An initializer to provision an instance for a specific Provider
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