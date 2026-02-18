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
 * - Data disk, base image, and instance server status
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

    async setRootDiskId(rootDiskId: string | undefined): Promise<void> {
        await this.infraStateManager.setRootDiskId(rootDiskId)
    }

    async setDataDiskId(dataDiskId: string | undefined): Promise<void> {
        await this.infraStateManager.setDataDiskId(dataDiskId)
    }

    async setDataDiskSnapshotId(dataDiskSnapshotId: string | undefined): Promise<void> {
        await this.infraStateManager.setDataDiskSnapshotId(dataDiskSnapshotId)
    }

    async setBaseImageId(baseImageId: string | undefined): Promise<void> {
        await this.infraStateManager.setBaseImageId(baseImageId)
    }

    async setServerId(serverId: string | undefined): Promise<void> {
        await this.infraStateManager.setServerId(serverId)
    }

    async getInstanceInfra(): Promise<DummyInfrastructureStatus | undefined> {
        return await this.infraStateManager.getInstanceInfra()
    }
}

interface DummyInstanceInStateStatusArgs {
    instanceName: string
    coreConfig: CoreConfig
}

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
        await this.updateInfra({ serverStatus: status })
    }

    async setRootDiskId(rootDiskId: string | undefined): Promise<void> {
        await this.updateInfra({ rootDiskId })
    }

    async setDataDiskId(dataDiskId: string | undefined): Promise<void> {
        await this.updateInfra({ dataDiskId })
    }

    async setDataDiskSnapshotId(dataDiskSnapshotId: string | undefined): Promise<void> {
        await this.updateInfra({ dataDiskSnapshotId })
    }

    async setBaseImageId(baseImageId: string | undefined): Promise<void> {
        await this.updateInfra({ baseImageId })
    }

    async setServerId(serverId: string | undefined): Promise<void> {
        await this.updateInfra({ serverId })
    }

    private async updateInfra(updates: Partial<DummyInfrastructureStatus>): Promise<void> {
        this.logger.debug(`Updating infrastructure for ${this.args.instanceName} with: ${JSON.stringify(updates)}`)

        const currentState = await this.dummyProviderClient.getInstanceState(this.args.instanceName)
        const stateWriter = this.dummyProviderClient.getStateWriter()
        const currentInfra = currentState.dummyInfrastructure
        const newInfra: DummyInfrastructureStatus = {
            serverStatus: currentInfra?.serverStatus ?? ServerRunningStatus.Unknown,
            serverId: currentInfra?.serverId,
            rootDiskId: currentInfra?.rootDiskId,
            dataDiskId: currentInfra?.dataDiskId,
            dataDiskSnapshotId: currentInfra?.dataDiskSnapshotId,
            baseImageId: currentInfra?.baseImageId,
            lastUpdate: Date.now(),
            ...updates,
        }
        const newState = {
            ...currentState,
            dummyInfrastructure: newInfra,
        }

        this.logger.debug(`Setting new state for dummy instance ${this.args.instanceName}: ${JSON.stringify(newState)}`)

        await stateWriter.setState(newState)
    }
}