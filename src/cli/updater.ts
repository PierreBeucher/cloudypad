import { PartialDeep } from "type-fest"
import { InstanceInputs, InstanceStateV1 } from "../core/state/state"
import { StateWriter } from "../core/state/writer"
import { getLogger, Logger } from "../log/utils"
import { InstanceManagerBuilder } from "../core/manager-builder"
import { StateLoader } from "../core/state/loader"
import { UpdateCliArgs } from "./command"
import { GenericStateParser } from "../core/state/parser"
import { AbstractInputPrompter, ConfirmationPrompter } from "./prompter"
import * as lodash from "lodash"

export interface InstanceUpdaterArgs<ST extends InstanceStateV1, A extends UpdateCliArgs> {
    stateParser: GenericStateParser<ST>
    inputPrompter: AbstractInputPrompter<A, ST["provision"]["input"], ST["configuration"]["input"]>  
}

export interface InstanceUpdateArgs<ST extends InstanceStateV1> {
    provisionInput?: PartialDeep<ST["provision"]["input"]>,
    configurationInput?: PartialDeep<ST["configuration"]["input"]>
}

export class InstanceUpdater<ST extends InstanceStateV1, A extends UpdateCliArgs> {

    private logger: Logger
    private stateParser: GenericStateParser<ST>
    private inputPrompter: AbstractInputPrompter<A, ST["provision"]["input"], ST["configuration"]["input"]>  

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
        const cliInput = this.inputPrompter.cliArgsIntoPartialInput(cliArgs)

        this.logger.debug(`Loaded state input for update ${JSON.stringify(stateInput)}`)
        this.logger.debug(`Loaded CLI input for update ${JSON.stringify(cliInput)}`)

        const existingInput = lodash.merge({}, stateInput, cliInput)

        this.logger.debug(`Loaded input for update ${JSON.stringify(existingInput)}`)

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

        const manager = await InstanceManagerBuilder.get().buildInstanceManager(instanceName)

        const prompter = new ConfirmationPrompter()
        const confirmation = await prompter.confirmCreation(instanceName, await manager.getInputs(), cliArgs.yes)
        if(!confirmation){
            throw new Error('Provision aborted.')
        }


        await manager.provision({ autoApprove: cliArgs.yes })
        await manager.configure()
    }

}