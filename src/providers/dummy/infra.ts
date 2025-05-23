import { ServerRunningStatus } from "../../core/runner"
import { getLogger } from "../../log/utils"

export interface DummyInstanceInfraManagerArgs {
    instanceName: string
}

/**
 * Interface to manage dummy infrastructure for dummy instances:
 * - Instance status and last update time
 */
export class DummyInstanceInfraManager {

    private readonly logger = getLogger(DummyInstanceInfraManager.name)
    private readonly args: DummyInstanceInfraManagerArgs
    private readonly dummyMemoryManager = DummyInstanceInternalMemory.get()

    constructor(args: DummyInstanceInfraManagerArgs) {
        this.args = args
    }

    async setServerRunningStatus(status: ServerRunningStatus): Promise<void> {

        this.logger.debug(`Dummy instance infra: setting running status of ${this.args.instanceName} to ${status}`)

        this.dummyMemoryManager.setInstanceStatus(this.args.instanceName, status)
        
        this.logger.debug(`Dummy instance infra: running status of ${this.args.instanceName} set to ${status}`)
    }

    async getServerRunningStatus(): Promise<{ status: ServerRunningStatus, lastUpdate: number }> {

        this.logger.debug(`Dummy instance infra: getting running status of ${this.args.instanceName}`)
        
        const currentInfra = this.dummyMemoryManager.getInstanceInfra(this.args.instanceName)

        return {
            status: currentInfra.status,
            lastUpdate: currentInfra.lastUpdate
        }
    }
}

export interface DummyInstanceInfrastructure {
    status: ServerRunningStatus
    lastUpdate: number
}

/**
 * Internal memory for dummy instances. Used for operations on Dummy instances such as state update, start, stop, restart, etc.
 */
class DummyInstanceInternalMemory {

    private static instance: DummyInstanceInternalMemory
    
    public static get(): DummyInstanceInternalMemory {
        if (!DummyInstanceInternalMemory.instance) {
            DummyInstanceInternalMemory.instance = new DummyInstanceInternalMemory()
        }
        return DummyInstanceInternalMemory.instance
    }

    private dummyInfrastructure: Map<string, DummyInstanceInfrastructure>

    private logger = getLogger('DummyInstanceProviderClient')

    private constructor() {
        this.dummyInfrastructure = new Map<string, DummyInstanceInfrastructure>()
    }

    public getInstanceInfra(instanceName: string): DummyInstanceInfrastructure {
        this.logger.debug(`Get dummy instance details for ${instanceName}`)
        const currentInfra = this.dummyInfrastructure.get(instanceName)
        
        if (!currentInfra) {
            this.logger.debug(`Dummy instance infra: no infrastructure found for ${instanceName}, creating new infrastructure`)
            const newInfra: DummyInstanceInfrastructure = {
                status: ServerRunningStatus.Stopped,
                lastUpdate: 0
            }
            this.dummyInfrastructure.set(instanceName, newInfra)
            return newInfra
        }

        return currentInfra
    }

    public setInstanceStatus(instanceName: string, status: ServerRunningStatus) {
        this.logger.debug(`Set dummy instance status for ${instanceName}: ${status}`)
        this.dummyInfrastructure.set(instanceName, {
            status: status,
            lastUpdate: Date.now()
        })
    }

}

