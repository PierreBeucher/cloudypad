import { PartialDeep } from "type-fest"
import { InstanceProvisionOptions } from "./provisioner"
import { InstanceStateV1 } from "./state/state"
import { StateWriter } from "./state/writer"
import { getLogger } from "../log/utils"
import { InstanceManagerBuilder } from "./manager-builder"

export interface InstanceUpdaterArgs<ST extends InstanceStateV1> {
    stateWriter: StateWriter<ST>
}

export interface InstanceUpdateArgs<ST extends InstanceStateV1> {
    provisionInput?: PartialDeep<ST["provision"]["input"]>,
    configurationInput?: PartialDeep<ST["configuration"]["input"]>
}

export class InstanceUpdater<ST extends InstanceStateV1> {

    protected readonly logger
    protected readonly stateWriter: StateWriter<ST>

    constructor(args: InstanceUpdaterArgs<ST>){
        this.stateWriter = args.stateWriter
        this.logger = getLogger(args.stateWriter.instanceName())
    }

    async update(updates: InstanceUpdateArgs<ST>, opts: InstanceProvisionOptions): Promise<void> {

        const intanceName = this.stateWriter.instanceName()
        this.logger.debug(`Updating instance ${intanceName} with ${JSON.stringify(updates)} and options ${JSON.stringify(opts)}`)

        if(updates.provisionInput) {
            await this.stateWriter.updateProvisionInput(updates.provisionInput)
        }
        
        if(updates.configurationInput) {
            await this.stateWriter.updateConfigurationInput(updates.configurationInput)
        }
        
        this.logger.debug(`State after update ${JSON.stringify(this.stateWriter.cloneState())}`)

        const manager = await new InstanceManagerBuilder().buildInstanceManager(this.stateWriter.instanceName())

        await manager.provision(opts)
        await manager.configure()
    }

}