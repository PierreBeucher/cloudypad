import { InstanceStateV1 } from "../core/state/state"
import { getLogger, Logger } from "../log/utils"
import { UpdateCliArgs } from "./command"
import { AbstractInputPrompter, ConfirmationPrompter } from "./prompter"
import { AbstractProviderClient } from "../core/provider"

export interface InteractiveInstanceUpdaterArgs<ST extends InstanceStateV1, A extends UpdateCliArgs> {
    inputPrompter: AbstractInputPrompter<A, ST["provision"]["input"], ST["configuration"]["input"]>  
    providerClient: AbstractProviderClient<ST>
}

/**
 * Interactively update an existing instance using CLI args and prompting when required 
 * and to confirm actions.
 */
export class InteractiveInstanceUpdater<ST extends InstanceStateV1, A extends UpdateCliArgs> {

    private logger: Logger
    private inputPrompter: AbstractInputPrompter<A, ST["provision"]["input"], ST["configuration"]["input"]>  
    private providerClient: AbstractProviderClient<ST>

    constructor(args: InteractiveInstanceUpdaterArgs<ST, A>) {
        this.logger = getLogger(InteractiveInstanceUpdater.name)
        this.inputPrompter = args.inputPrompter
        this.providerClient = args.providerClient
    }

    async updateInteractive(cliArgs: A): Promise<void> {
        
        this.logger.debug(`Updating instance ${cliArgs.name} with CLI args: ${JSON.stringify(cliArgs)}`)

        const instanceName = cliArgs.name
        const cliInput = this.inputPrompter.cliArgsIntoPartialInput(cliArgs)

        this.logger.debug(`Updating instance ${instanceName} with inputs: ${JSON.stringify(cliInput)}`)

        const prompter = new ConfirmationPrompter()
        const confirmation = await prompter.confirmDeploy(instanceName, {
            instanceName: instanceName,
            provision: cliInput.provision,
            configuration: cliInput.configuration
        }, cliArgs.yes)

        if(!confirmation){
            throw new Error('Update aborted.')
        }
        const instanceUpdater = this.providerClient.getInstanceUpdater()
        await instanceUpdater.updateStateOnly({
            instanceName: instanceName,
            configurationInputs: cliInput.configuration,
            provisionInputs: cliInput.provision
        })

        const manager = await this.providerClient.getInstanceManager(instanceName)
        await manager.deploy()
    }

}
