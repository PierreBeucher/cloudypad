import { PartialDeep } from "type-fest"
import { InstanceStateV1 } from "./state/state"
import { StateWriter } from "./state/writer"
import { getLogger, Logger } from "../log/utils"
import { InstanceManagerBuilder } from "./manager-builder"
import { StateLoader } from "./state/loader"
import { UpdateCliArgs } from "./cli/command"
import { GenericStateParser } from "./state/parser"
import { AbstractInputPrompter } from "./cli/prompter"
import * as lodash from "lodash"

export interface InstanceUpdaterArgs<ST extends InstanceStateV1, A extends UpdateCliArgs> {
    stateParser: GenericStateParser<ST>
    inputPrompter: AbstractInputPrompter<A, { 
        instanceName: string, 
        provision: ST["provision"]["input"], 
        configuration: ST["configuration"]["input"] 
    }>  
}

export interface InstanceUpdateArgs<ST extends InstanceStateV1> {
    provisionInput?: PartialDeep<ST["provision"]["input"]>,
    configurationInput?: PartialDeep<ST["configuration"]["input"]>
}

export class InstanceUpdater<ST extends InstanceStateV1, A extends UpdateCliArgs> {

    private logger: Logger
    private stateParser: GenericStateParser<ST>
    private inputPrompter: AbstractInputPrompter<A, { 
        instanceName: string, 
        provision: ST["provision"]["input"], 
        configuration: ST["configuration"]["input"] 
    }>  

    constructor(args: InstanceUpdaterArgs<ST, A>) {
        this.logger = getLogger(InstanceUpdater.name)
        this.stateParser = args.stateParser
        this.inputPrompter = args.inputPrompter
    }

    async update(cliArgs: A): Promise<void> {
        
        // Load existing state
        const instanceName = cliArgs.name
        const rawState = await new StateLoader().loadAndMigrateInstanceState(instanceName)
        const state = this.stateParser.parse(rawState)

        // Merge existing input with provided CLI args
        const stateInput: { 
            instanceName: string, 
            provision: ST["provision"]["input"], 
            configuration: ST["configuration"]["input"] 
        } = {
            instanceName: instanceName,
            provision: state.provision.input,
            configuration: state.configuration.input
        }
        const cliInput = this.inputPrompter.cliArgsIntoInput(cliArgs)
        const existingInput = lodash.merge({}, stateInput, cliInput)

        // Complete to full input, prompt user for missing values
        const fullInput = await this.inputPrompter.promptInput(existingInput, {
            overwriteExisting: true,
            skipQuotaWarning: true
        })

        // Do update
        this.logger.debug(`Updating instance ${instanceName} with ${JSON.stringify(fullInput)}`)

        const stateWriter = new StateWriter<ST>({ state: state })
        await stateWriter.setProvisionInput(fullInput.provision)
        await stateWriter.setConfigurationInput(fullInput.configuration)
        
        this.logger.debug(`State after update ${JSON.stringify(stateWriter.cloneState())}`)

        const manager = await new InstanceManagerBuilder().buildInstanceManager(instanceName)

        await manager.provision({ autoApprove: cliArgs.yes })
        await manager.configure()
    }

}