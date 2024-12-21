import { AbstractInstanceRunner, InstanceRunnerArgs } from "../../core/runner"
import { PaperspaceClient } from "./client/client"
import { PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1 } from "./state"

export type PaperspaceInstanceRunnerArgs = InstanceRunnerArgs<PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1>

export class PaperspaceInstanceRunner extends AbstractInstanceRunner<PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1>  {

    private client: PaperspaceClient

    constructor(args: PaperspaceInstanceRunnerArgs) {
        super(args)

        this.client = new PaperspaceClient({ name: this.args.instanceName, apiKey: this.args.input.apiKey})
    }

    async doStart() {
        await this.client.startMachine(this.args.output.machineId)
    }

    async doStop() {
        await this.client.stopMachine(this.args.output.machineId)
    }

    async doRestart() {
        await this.client.restartMachine(this.args.output.machineId)
    }

}