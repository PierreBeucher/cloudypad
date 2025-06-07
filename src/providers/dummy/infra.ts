import { ServerRunningStatus } from "../../core/runner"
import { getLogger } from "../../log/utils"
import { DummyProviderClient } from "./provider"
import { CoreConfig } from "../../core/config/interface"
import { DummyInfrastructureStatus } from "./state"

export interface DummyInstanceInfraManagerArgs {
    instanceName: string
    coreConfig: CoreConfig
}

/**
 * Interface to manage dummy infrastructure for dummy instances:
 * - Instance status and last update time
 */
export class DummyInstanceInfraManager {

    // private readonly logger = getLogger(DummyInstanceInfraManager.name)
    private readonly args: DummyInstanceInfraManagerArgs

    private readonly infraStateManager: DummyInstanceInStateStatus

    constructor(args: DummyInstanceInfraManagerArgs) {
        this.args = args
        this.infraStateManager = new DummyInstanceInStateStatus({
            instanceName: this.args.instanceName,
            coreConfig: this.args.coreConfig
        })
    }

    async setServerRunningStatus(status: ServerRunningStatus): Promise<void> {
        await this.infraStateManager.setServerRunningStatus(status)
    }

    async getServerRunningStatus(): Promise<{ status: ServerRunningStatus, lastUpdate: number }> {
        
        const currentInfra = await this.infraStateManager.getInstanceInfra()

        return {
            status: currentInfra?.serverStatus ?? ServerRunningStatus.Unknown,
            lastUpdate: currentInfra?.lastUpdate ?? 0
        }
    }
}

interface DummyInstanceInStateStatusArgs {
    instanceName: string
    coreConfig: CoreConfig
}

// export interface DummyInstanceInfraStatus {
//     /**
//      * Current dummy server status
//      */
//     serverStatus: ServerRunningStatus

//     /**
//      * Current dummy server id
//      */
//     serverId?: string

//     /**
//      * Last update time
//      */
//     lastUpdate: number
// }

class DummyInstanceInStateStatus {
    private readonly args: DummyInstanceInStateStatusArgs
    private readonly dummyProviderClient: DummyProviderClient
    private readonly logger = getLogger(DummyInstanceInStateStatus.name)
    constructor(args: DummyInstanceInStateStatusArgs) {
        this.args = args
        this.dummyProviderClient = new DummyProviderClient({
            config: this.args.coreConfig
        })
    }

    async getInstanceInfra(): Promise<DummyInfrastructureStatus | undefined> {
        this.logger.debug(`Getting infrastructure for dummy instance ${this.args.instanceName}`)

        const instanceState = await this.dummyProviderClient.getInstanceState(this.args.instanceName)

        this.logger.debug(`Current state for dummy instance ${this.args.instanceName}: ${JSON.stringify(instanceState)}`)

        return instanceState.dummyInfrastructure
    }

    async setServerRunningStatus(status: ServerRunningStatus): Promise<void> {
        this.logger.debug(`Setting server running status for ${this.args.instanceName} to ${status}`)

        const currentState = await this.dummyProviderClient.getInstanceState(this.args.instanceName)
        const stateWriter = this.dummyProviderClient.getStateWriter()
        const currentInfra = currentState.dummyInfrastructure
        const newInfra = {
            ...currentInfra,
            serverStatus: status,
            lastUpdate: Date.now()
        }
        const newState = {
            ...currentState,
            dummyInfrastructure: newInfra,
        }

        this.logger.debug(`Setting new state for dummy instance ${this.args.instanceName}: ${JSON.stringify(newState)}`)

        await stateWriter.setStateAndPersistNow(newState)
    }
}



// interface DummyInstanceInternalMemoryArgs {
//     coreConfig: CoreConfig
// }

// /**
//  * Singletong holding dummy instances in memory. Used for operations on Dummy instances such as state update, start, stop, restart, etc.
//  */
// class DummyInstanceInternalMemory {

//     private static instance: DummyInstanceInternalMemory
    
//     public static get(args: DummyInstanceInternalMemoryArgs): DummyInstanceInternalMemory {
//         if (!DummyInstanceInternalMemory.instance) {
//             DummyInstanceInternalMemory.instance = new DummyInstanceInternalMemory(args)
//         }
//         return DummyInstanceInternalMemory.instance
//     }

//     private dummyInfrastructure: Map<string, DummyInstanceInfraStatus>
//     private readonly args: DummyInstanceInternalMemoryArgs
//     private logger = getLogger('DummyInstanceProviderClient')

//     private constructor(args: DummyInstanceInternalMemoryArgs) {
//         this.args = args
//         this.dummyInfrastructure = new Map<string, DummyInstanceInfraStatus>()
//     }

//     /**
//      * Get current dummy infrastructure status for a dummy instance. 
//      * If no infrastructure is found for an instance:
//      * - Try to get current Core state for the instance
//      * - Create a dummy infrastructure matching a Stopped status
//      * - Add events to emulate a stopped instance
//      * 
//      * @param instanceName 
//      * @returns 
//      */
//     public async getInstanceInfra(instanceName: string): Promise<DummyInstanceInfraStatus> {
//         this.logger.debug(`Get dummy instance details for ${instanceName}`)
//         const currentInfra = this.dummyInfrastructure.get(instanceName)
        
//         if (!currentInfra) {
//             this.logger.debug(`Dummy instance infra: no infrastructure found for ${instanceName}, creating new infrastructure`)
            
//             const dummyProviderClient = new DummyProviderClient({
//                 config: this.args.coreConfig
//             })
//             const instanceState = await dummyProviderClient.getInstanceState(instanceName)

//             let newInfra: DummyInstanceInfraStatus
//             const lastUpdate = new Date().getTime()

//             // if instance server is deleted on stop, create a new infrastructure with Unknown status
//             if(instanceState.provision.input.deleteInstanceServerOnStop) {
//                 this.logger.debug(`Dummy instance infra: deleteInstanceServerOnStop is true for ${instanceName}, creating new infrastructure`)
//                 newInfra = {
//                     serverStatus: ServerRunningStatus.Unknown,
//                     lastUpdate: lastUpdate
//                 }
//             } else {
//                 this.logger.debug(`Dummy instance infra: deleteInstanceServerOnStop is false for ${instanceName}, creating new infrastructure`)
//                 newInfra = {
//                     serverStatus: ServerRunningStatus.Stopped,
//                     lastUpdate: lastUpdate
//                 }
//             }
            
//             this.dummyInfrastructure.set(instanceName, newInfra)
//             return newInfra
//         }

//         return currentInfra
//     }

//     /**
//      * Create dummy instance infrastructure
//      * @param instanceName 
//      * @param serverId 
//      */
//     public provision(instanceName: string, serverId?: string, serverStatus: ServerRunningStatus = ServerRunningStatus.Running) {
//         this.logger.debug(`Provisioning dummy instance infrastructure for ${instanceName}: ${serverId}`)

//         if(!serverId) {
//             serverId = `dummy-id-${instanceName}-${Date.now()}`
//         }

//         this.dummyInfrastructure.set(instanceName, {
//             serverStatus: serverStatus,
//             serverId: serverId,
//             lastUpdate: Date.now()
//         })
//     }

//     public destroy(instanceName: string) {
//         this.logger.debug(`Destroying dummy instance infrastructure for ${instanceName}`)
//         this.dummyInfrastructure.delete(instanceName)
//     }

//     /**
//      * Delete dummy instance server. Internally set serverId to undefined and update lastUpdate time
//      * @param instanceName 
//      */
//     public deleteInstanceServer(instanceName: string) {
//         this.logger.debug(`Deleting dummy instance server for ${instanceName}`)
//         const currentInfra = this.dummyInfrastructure.get(instanceName)
//         if(currentInfra) {
//             currentInfra.serverId = undefined
//             currentInfra.lastUpdate = Date.now()

//             this.dummyInfrastructure.set(instanceName, currentInfra)
//         }
//     }

//     public setInstanceStatus(instanceName: string, status: ServerRunningStatus) {
//         this.logger.debug(`Set dummy instance status for ${instanceName}: ${status}`)
//         this.dummyInfrastructure.set(instanceName, {
//             serverStatus: status,
//             lastUpdate: Date.now()
//         })
//     }

// }

