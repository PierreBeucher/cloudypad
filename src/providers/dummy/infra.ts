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
        this.dummyMemoryManager.setInstanceStatus(this.args.instanceName, status)
    }

    async deleteInstanceServer(): Promise<void> {
        this.dummyMemoryManager.deleteInstanceServer(this.args.instanceName)
    }

    async provision(args?: { serverId?: string, serverStatus?: ServerRunningStatus }): Promise<void> {
        this.dummyMemoryManager.provision(this.args.instanceName, args?.serverId, args?.serverStatus)
    }

    async destroy(): Promise<void> {
        this.dummyMemoryManager.destroy(this.args.instanceName)
    }

    async getServerRunningStatus(): Promise<{ status: ServerRunningStatus, lastUpdate: number }> {
        
        const currentInfra = this.dummyMemoryManager.getInstanceInfra(this.args.instanceName)

        return {
            status: currentInfra.serverStatus,
            lastUpdate: currentInfra.lastUpdate
        }
    }
}

export interface DummyInstanceInfraStatus {
    /**
     * Current dummy server status
     */
    serverStatus: ServerRunningStatus

    /**
     * Current dummy server id
     */
    serverId?: string

    /**
     * Last update time
     */
    lastUpdate: number
}

/**
 * Singletong holding dummy instances in memory. Used for operations on Dummy instances such as state update, start, stop, restart, etc.
 */
class DummyInstanceInternalMemory {

    private static instance: DummyInstanceInternalMemory
    
    public static get(): DummyInstanceInternalMemory {
        if (!DummyInstanceInternalMemory.instance) {
            DummyInstanceInternalMemory.instance = new DummyInstanceInternalMemory()
        }
        return DummyInstanceInternalMemory.instance
    }

    private dummyInfrastructure: Map<string, DummyInstanceInfraStatus>

    private logger = getLogger('DummyInstanceProviderClient')

    private constructor() {
        this.dummyInfrastructure = new Map<string, DummyInstanceInfraStatus>()
    }

    public getInstanceInfra(instanceName: string): DummyInstanceInfraStatus {
        this.logger.debug(`Get dummy instance details for ${instanceName}`)
        const currentInfra = this.dummyInfrastructure.get(instanceName)
        
        if (!currentInfra) {
            this.logger.debug(`Dummy instance infra: no infrastructure found for ${instanceName}, creating new infrastructure`)
            const newInfra: DummyInstanceInfraStatus = {
                serverStatus: ServerRunningStatus.Stopped,
                lastUpdate: 0
            }
            this.dummyInfrastructure.set(instanceName, newInfra)
            return newInfra
        }

        return currentInfra
    }

    /**
     * Create dummy instance infrastructure
     * @param instanceName 
     * @param serverId 
     */
    public provision(instanceName: string, serverId?: string, serverStatus: ServerRunningStatus = ServerRunningStatus.Running) {
        this.logger.debug(`Provisioning dummy instance infrastructure for ${instanceName}: ${serverId}`)

        if(!serverId) {
            serverId = `dummy-id-${instanceName}-${Date.now()}`
        }

        this.dummyInfrastructure.set(instanceName, {
            serverStatus: serverStatus,
            serverId: serverId,
            lastUpdate: Date.now()
        })
    }

    public destroy(instanceName: string) {
        this.logger.debug(`Destroying dummy instance infrastructure for ${instanceName}`)
        this.dummyInfrastructure.delete(instanceName)
    }

    /**
     * Delete dummy instance server. Internally set serverId to undefined and update lastUpdate time
     * @param instanceName 
     */
    public deleteInstanceServer(instanceName: string) {
        this.logger.debug(`Deleting dummy instance server for ${instanceName}`)
        const currentInfra = this.dummyInfrastructure.get(instanceName)
        if(currentInfra) {
            currentInfra.serverId = undefined
            currentInfra.lastUpdate = Date.now()

            this.dummyInfrastructure.set(instanceName, currentInfra)
        }
    }

    public setInstanceStatus(instanceName: string, status: ServerRunningStatus) {
        this.logger.debug(`Set dummy instance status for ${instanceName}: ${status}`)
        this.dummyInfrastructure.set(instanceName, {
            serverStatus: status,
            lastUpdate: Date.now()
        })
    }

}

