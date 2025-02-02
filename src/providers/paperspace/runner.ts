import { CLOUDYPAD_PROVIDER_PAPERSPACE } from "../../core/const"
import { AbstractInstanceRunner, InstanceRunnerArgs, StartStopOptions } from "../../core/runner"
import { PaperspaceClient } from "./client/client"
import { MachinesCreate200ResponseDataStateEnum } from "./client/generated-api"
import { PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1 } from "./state"

export type PaperspaceInstanceRunnerArgs = InstanceRunnerArgs<PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1>

export class PaperspaceInstanceRunner extends AbstractInstanceRunner<PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1>  {

    private client: PaperspaceClient

    constructor(args: PaperspaceInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_PAPERSPACE, args)

        this.client = new PaperspaceClient({ name: this.args.instanceName, apiKey: this.args.provisionInput.apiKey})
    }

    async doStart(opts?: StartStopOptions) {
        await this.client.startMachine(this.args.provisionOutput.machineId)
        await this.client.waitForMachineState(this.args.provisionOutput.machineId, MachinesCreate200ResponseDataStateEnum.Ready)
    }

    async doStop(opts?: StartStopOptions) {
        await this.client.stopMachine(this.args.provisionOutput.machineId)
        await this.client.waitForMachineState(this.args.provisionOutput.machineId, MachinesCreate200ResponseDataStateEnum.Off)
    }

    async doRestart(opts?: StartStopOptions) {
        await this.client.restartMachine(this.args.provisionOutput.machineId)
        await this.client.waitForMachineState(this.args.provisionOutput.machineId, MachinesCreate200ResponseDataStateEnum.Ready)
    }

}