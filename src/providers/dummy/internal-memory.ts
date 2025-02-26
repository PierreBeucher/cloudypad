import { InstanceRunningStatus } from "../../core/runner"
import { getLogger, Logger } from "../../log/utils"

/**
 * A Dummy instance "provider client" used for operations on Dummy instances such as start, stop, restart, etc.
 * Counterpart of "real" provider clients like AwsClient.
 * 
 * Keeps instances running and operational statuses in memory.
 */
export class DummyInstanceProviderClient {

    private static instance: DummyInstanceProviderClient
    
    public static get(): DummyInstanceProviderClient {
        if (!DummyInstanceProviderClient.instance) {
            DummyInstanceProviderClient.instance = new DummyInstanceProviderClient()
        }
        return DummyInstanceProviderClient.instance
    }

    private instanceStatuses: Map<string, DummyInstanceCloudDetails>
    private logger: Logger = getLogger('DummyInstanceProviderClient')

    private constructor() {
        this.instanceStatuses = new Map<string, DummyInstanceCloudDetails>()
    }

    public getAllInstanceDetails(): Map<string, DummyInstanceCloudDetails> {
        return this.instanceStatuses
    }

    public getInstanceDetails(instanceName: string): DummyInstanceCloudDetails | undefined {
        this.logger.debug(`Get dummy instance details for ${instanceName}`)
        return this.instanceStatuses.get(instanceName)
    }

    public setInstanceDetails(instanceName: string, details: DummyInstanceCloudDetails) {
        this.logger.debug(`Set dummy instance details for ${instanceName}: ${JSON.stringify(details)}`)
        this.instanceStatuses.set(instanceName, details)
    }
}

export interface DummyInstanceCloudDetails {
    instanceName: string
    status: InstanceRunningStatus
}