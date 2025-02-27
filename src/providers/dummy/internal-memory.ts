import { InstanceRunningStatus } from "../../core/runner"
import { getLogger, Logger } from "../../log/utils"
import { DummyInstanceStateV1 } from "./state"

export interface DummyInstanceCloudDetails {
    instanceName: string
    status: InstanceRunningStatus
}

/**
 * Internal memory for dummy instances. Used for operations on Dummy instances such as state update, start, stop, restart, etc.
 */
export class DummyInstanceInternalMemory {

    private static instance: DummyInstanceInternalMemory
    
    public static get(): DummyInstanceInternalMemory {
        if (!DummyInstanceInternalMemory.instance) {
            DummyInstanceInternalMemory.instance = new DummyInstanceInternalMemory()
        }
        return DummyInstanceInternalMemory.instance
    }

    private dummyCloudDetails: Map<string, DummyInstanceCloudDetails>

    private logger: Logger = getLogger('DummyInstanceProviderClient')

    private constructor() {
        this.dummyCloudDetails = new Map<string, DummyInstanceCloudDetails>()
    }

    public getAllInstanceDetails(): Map<string, DummyInstanceCloudDetails> {
        return this.dummyCloudDetails
    }

    public getInstanceDetails(instanceName: string): DummyInstanceCloudDetails | undefined {
        this.logger.debug(`Get dummy instance details for ${instanceName}`)
        return this.dummyCloudDetails.get(instanceName)
    }

    public setInstanceDetails(instanceName: string, details: DummyInstanceCloudDetails) {
        this.logger.debug(`Set dummy instance details for ${instanceName}: ${JSON.stringify(details)}`)
        this.dummyCloudDetails.set(instanceName, details)
    }

}

