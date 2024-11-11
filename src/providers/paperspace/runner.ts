import { AbstractInstanceRunner, InstanceRunnerArgs } from "../../core/runner"
import { PaperspaceClient } from "./client/client"
import { PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1 } from "./state"

export type PaperspaceInstanceRunnerArgs = InstanceRunnerArgs<PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1>

export class PaperspaceInstanceRunner extends AbstractInstanceRunner<PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1>  {

    private client: PaperspaceClient

    constructor(args: PaperspaceInstanceRunnerArgs) {
        super(args)

        this.client = new PaperspaceClient({ name: this.args.instanceName, apiKey: this.args.config.apiKey})
    }

    async start() {
        await super.start()
        await this.client.startMachine(this.args.output.machineId)
    }

    async stop() {
        await super.stop()
        await this.client.stopMachine(this.args.output.machineId)
    }

    async restart() {
        await super.restart()
        await this.client.restartMachine(this.args.output.machineId)
    }

}