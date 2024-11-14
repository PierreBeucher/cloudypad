import { AbstractInstanceRunner, AbstractInstanceRunnerArgs } from "../../core/runner"
import { PaperspaceClient } from "./client/client"
import { PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1 } from "./state"

export interface PaperspaceInstanceRunnerArgs extends AbstractInstanceRunnerArgs {
    pspaceConfig: PaperspaceProvisionConfigV1,
    pspaceOutput: PaperspaceProvisionOutputV1,
}

export class PaperspaceInstanceRunner extends AbstractInstanceRunner {
    
    private client: PaperspaceClient

    private readonly pspaceArgs: PaperspaceInstanceRunnerArgs
    
    constructor(pspaceArgs: PaperspaceInstanceRunnerArgs) {
        super(pspaceArgs)

        this.pspaceArgs = pspaceArgs
        this.client = new PaperspaceClient({ name: this.pspaceArgs.instanceName, apiKey: this.pspaceArgs.pspaceConfig.apiKey})
    }
    
    async start() {
        await super.start()
        await this.client.startMachine(this.pspaceArgs.pspaceOutput.machineId)
    }

    async stop() {
        await super.stop()
        await this.client.stopMachine(this.pspaceArgs.pspaceOutput.machineId)
    }

    async restart() {
        await super.restart()
        await this.client.restartMachine(this.pspaceArgs.pspaceOutput.machineId)
    }

}