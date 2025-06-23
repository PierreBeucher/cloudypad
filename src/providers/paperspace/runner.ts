import { CLOUDYPAD_PROVIDER_PAPERSPACE } from "../../core/const"
import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from "../../core/runner"
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
        // wait for machine to be restarting before checking for ready state
        // to avoid false positive as machine will still be "ready" for a few seconds after restart request
        // unless restart is blastingly fast this should work as expected
        await this.client.waitForMachineState(this.args.provisionOutput.machineId, MachinesCreate200ResponseDataStateEnum.Restarting)
        await this.client.waitForMachineState(this.args.provisionOutput.machineId, MachinesCreate200ResponseDataStateEnum.Ready)
    }

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        const machine = await this.client.getMachine(this.args.provisionOutput.machineId)
        if (machine.state === MachinesCreate200ResponseDataStateEnum.Off) {
            return ServerRunningStatus.Stopped
        }
        return ServerRunningStatus.Running
    }

}
