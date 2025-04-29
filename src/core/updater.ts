import { PartialDeep } from "type-fest"
import { InstanceStateV1 } from "../core/state/state"
import { getLogger, Logger } from "../log/utils"
import { GenericStateParser } from "../core/state/parser"
import * as lodash from "lodash"
import { StateManagerBuilder } from "../core/state/builders"
import { InstanceManagerBuilder } from "./manager-builder"

export interface InstanceUpdaterArgs<ST extends InstanceStateV1> {
    stateParser: GenericStateParser<ST>
}

/**
 * Update an existing instance using new inputs.
 */
export class InstanceUpdater<ST extends InstanceStateV1> {

    private logger: Logger
    private stateParser: GenericStateParser<ST>

    constructor(args: InstanceUpdaterArgs<ST>) {
        this.logger = getLogger(InstanceUpdater.name)
        this.stateParser = args.stateParser
    }

    /**
     * Update the state of an instance with new inputs and run deployment.
     * @param instanceName 
     * @param configurationInputs 
     * @param provisionInputs 
     */
    async updateAndDeploy(
        instanceName: string,
        configurationInputs?: PartialDeep<ST["configuration"]["input"]>, 
        provisionInputs?: PartialDeep<ST["provision"]["input"]>
    ): Promise<void> {
        await this.updateStateOnly(instanceName, configurationInputs, provisionInputs)

        const manager = await InstanceManagerBuilder.get().buildInstanceManager(instanceName)
        await manager.deploy()
    }

    /**
     * Update the state of an instance with new inputs without running deployment.
     * @param instanceName 
     * @param configurationInputs 
     * @param provisionInputs 
     */
    async updateStateOnly(
        instanceName: string,
        configurationInputs?: PartialDeep<ST["configuration"]["input"]>, 
        provisionInputs?: PartialDeep<ST["provision"]["input"]>
    ): Promise<void> {
        
        this.logger.debug(`Updating state of instance ${instanceName} with configuration inputs: ` +
            `${JSON.stringify(configurationInputs)} and provision inputs: ` +
            `${JSON.stringify(provisionInputs)}`)

        const state = await this.loadState(instanceName)

        this.logger.debug(`State loaded for update: ${JSON.stringify(state)}`)

        const newInputs = await this.mergeInputsWithStateInputs(state, configurationInputs, provisionInputs)

        this.logger.debug(`New inputs after merging with state inputs: ${JSON.stringify(newInputs)}`)
        
        await this.updateStateWithInputs(state, newInputs.provisionInputs, newInputs.configurationInputs)
    }

    private async loadState(instanceName: string): Promise<ST>{
        const loader = StateManagerBuilder.getInstance().buildStateLoader()
        const rawState = await loader.loadInstanceState(instanceName)
        return this.stateParser.parse(rawState)
    }

    /**
     * Take partial inputs and merge them with current state for given instance.
     * @param instanceName 
     * @param configurationInputs 
     * @param provisionInputs 
     * @returns 
     */
    private async mergeInputsWithStateInputs(state: ST, 
            configurationInputs?: PartialDeep<ST["configuration"]["input"]>, 
            provisionInputs?: PartialDeep<ST["provision"]["input"]>
    ): Promise<{
        configurationInputs: ST["configuration"]["input"],
        provisionInputs: ST["provision"]["input"]
    }> {
        
        const newConfigInput: ST["configuration"]["input"] = lodash.merge({}, state.configuration.input, configurationInputs)
        const newProvisionInput: ST["provision"]["input"] = lodash.merge({}, state.provision.input, provisionInputs)

        return {
            configurationInputs: newConfigInput,
            provisionInputs: newProvisionInput
        }
    }

    private async updateStateWithInputs(state: ST, 
        provisionInputs: ST["provision"]["input"],
        configurationInputs: ST["configuration"]["input"]
    ): Promise<void>{

        this.logger.debug(`Updating with new configuration inputs: ${JSON.stringify(configurationInputs)}`)
        this.logger.debug(`Updating with new provision inputs: ${JSON.stringify(provisionInputs)}`)

        const stateWriter = StateManagerBuilder.getInstance().buildStateWriter(state)
        await stateWriter.setProvisionInput(provisionInputs)
        await stateWriter.setConfigurationInput(configurationInputs)

        this.logger.debug(`State after update ${JSON.stringify(stateWriter.cloneState())}`)
    }
}