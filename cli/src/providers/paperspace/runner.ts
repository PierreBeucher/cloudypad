import { AbstractInstanceRunner } from "../../core/runner"
import { StateManager } from "../../core/state"
import { PaperspaceClient } from "./client/client"

export class PaperspaceInstanceRunner extends AbstractInstanceRunner {
    
    private client: PaperspaceClient

    private machineId: string

    private name: string

    constructor(stateManager: StateManager) {
        super(stateManager)

        const state = stateManager.get()

        if (!state.provider?.paperspace) {
            throw new Error(`Invalidate state: provider must be Paperspace, got state: ${JSON.stringify(state)}`)
        }

        if(!state.provider.paperspace.machineId){
            throw new Error(`CloudyPadInstancePaperspace requires Paperspace instance ID. Got: ${JSON.stringify(state)}`)
        }

        this.machineId = state.provider.paperspace.machineId
        this.client = new PaperspaceClient({ apiKey: state.provider.paperspace.apiKey})
        this.name = state.name
    }
    
    async start() {
        await this.client.startMachine(this.machineId)
    }

    async stop() {
        await this.client.stopMachine(this.machineId)
    }

    async restart() {
        await this.client.restartMachine(this.machineId)
    }

}