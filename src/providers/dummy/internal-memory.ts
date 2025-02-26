import { InstanceRunningStatus } from "../../core/runner"

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

    private constructor() {
        this.instanceStatuses = new Map<string, DummyInstanceCloudDetails>()
    }

    public getInstanceDetails(instanceId: string): DummyInstanceCloudDetails | undefined {
        return this.instanceStatuses.get(instanceId)
    }

    public setInstanceDetails(instanceId: string, details: DummyInstanceCloudDetails) {
        this.instanceStatuses.set(instanceId, details)
    }
}

export interface DummyInstanceCloudDetails {
    instanceId: string
    status: InstanceRunningStatus
}