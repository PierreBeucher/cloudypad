import { AbstractInstanceRunner } from '../../core/runner'
import { StateManager } from '../../core/state'
import { AzureClient } from '../../tools/azure'

export class AzureInstanceRunner extends AbstractInstanceRunner {

    private client: AzureClient

    constructor(sm: StateManager) {
        super(sm)

        const state = sm.get()
        if (!state.provider?.azure?.provisionArgs) {
            throw new Error(`Invalid state: provider must be Azure, got state ${sm.get()}`)
        }

        this.client = new AzureClient(sm.name(), state.provider.azure.provisionArgs.create.subscriptionId)


    }

    private getVmName() {
        const state = this.stateManager.get()
        if (!state.provider?.azure?.vmName) {
            throw new Error("Couldn't perform operation: unknown instance ID.")
        }

        return state.provider.azure.vmName
    }

    private getResourceGroupName(){
        const state = this.stateManager.get()
        if (!state.provider?.azure?.resourceGroupName) {
            throw new Error("Couldn't perform operation: unknown resource group name.")
        }
        return state.provider?.azure?.resourceGroupName

    }

    async start() {
        await super.start()
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.restartInstance(resourceGroupName, vmName)
    }

    async stop() {
        await super.stop()
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.stopInstance(resourceGroupName, vmName)
    }

    async restart() {
        await super.restart()
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.restartInstance(resourceGroupName, vmName)
    }
}
