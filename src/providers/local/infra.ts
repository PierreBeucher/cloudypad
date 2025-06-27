import { ServerRunningStatus } from "../../core/runner"
import { getLogger } from "../../log/utils"

export interface LocalInstanceInfraManagerArgs {
    instanceName: string
}

/**
 * Interface to manage local infrastructure for local instances:
 * - Instance status and last update time
 */
export class LocalInstanceInfraManager {

    private readonly logger = getLogger(LocalInstanceInfraManager.name)
    private readonly args: LocalInstanceInfraManagerArgs
    private readonly localMemoryManager = LocalInstanceInternalMemory.get()

    constructor(args: LocalInstanceInfraManagerArgs) {
        this.args = args
    }

    async setServerRunningStatus(status: ServerRunningStatus): Promise<void> {

        this.logger.debug(`Local instance infra: setting running status of ${this.args.instanceName} to ${status}`)

        this.localMemoryManager.setInstanceStatus(this.args.instanceName, status)
        
        this.logger.debug(`Local instance infra: running status of ${this.args.instanceName} set to ${status}`)
    }

    async getServerRunningStatus(): Promise<{ status: ServerRunningStatus, lastUpdate: number }> {

        this.logger.debug(`Local instance infra: getting running status of ${this.args.instanceName}`)
        
        const currentInfra = this.localMemoryManager.getInstanceInfra(this.args.instanceName)

        return {
            status: currentInfra.status,
            lastUpdate: currentInfra.lastUpdate
        }
    }
}

export interface LocalInstanceInfrastructure {
    status: ServerRunningStatus
    lastUpdate: number
}

/**
 * Internal memory for local instances. Used for operations on Local instances such as state update, start, stop, restart, etc.
 */
class LocalInstanceInternalMemory {

    private static instance: LocalInstanceInternalMemory
    
    public static get(): LocalInstanceInternalMemory {
        if (!LocalInstanceInternalMemory.instance) {
            LocalInstanceInternalMemory.instance = new LocalInstanceInternalMemory()
        }
        return LocalInstanceInternalMemory.instance
    }

    private localInfrastructure: Map<string, LocalInstanceInfrastructure>

    private logger = getLogger('LocalInstanceProviderClient')

    private constructor() {
        this.localInfrastructure = new Map<string, LocalInstanceInfrastructure>()
    }

    public getInstanceInfra(instanceName: string): LocalInstanceInfrastructure {
        this.logger.debug(`Get local instance details for ${instanceName}`)
        const currentInfra = this.localInfrastructure.get(instanceName)
        
        if (!currentInfra) {
            this.logger.debug(`Local instance infra: no infrastructure found for ${instanceName}, creating new infrastructure`)
            const newInfra: LocalInstanceInfrastructure = {
                status: ServerRunningStatus.Stopped,
                lastUpdate: 0
            }
            this.localInfrastructure.set(instanceName, newInfra)
            return newInfra
        }

        return currentInfra
    }

    public setInstanceStatus(instanceName: string, status: ServerRunningStatus) {
        this.logger.debug(`Set local instance status for ${instanceName}: ${status}`)
        this.localInfrastructure.set(instanceName, {
            status: status,
            lastUpdate: Date.now()
        })
    }

}

