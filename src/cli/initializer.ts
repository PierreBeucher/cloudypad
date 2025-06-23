import { CLOUDYPAD_PROVIDER } from "../core/const"
import { CreateCliArgs } from "./command"
import { InputPrompter, UserVoluntaryInterruptionError } from "./prompter"
import { confirm } from '@inquirer/prompts'
import { AnalyticsManager } from "../tools/analytics/manager"
import { InstanceInputs } from "../core/state/state"
import { InstanceInitializer } from "../core/initializer"
import { getLogger } from "../log/utils"
import { InstanceStateV1 } from "../core/state/state"
import { AbstractProviderClient } from "../core/provider"

export interface InteractiveInstancerInitializerArgs<ST extends InstanceStateV1, A extends CreateCliArgs> {
    providerClient: AbstractProviderClient<ST>
    inputPrompter: InputPrompter<A, ST["provision"]["input"], ST["configuration"]["input"]>
    initArgs: A
}

export interface InstancerInitializationOptions {

    /**
     * Whether to show post-initialization message on console.
     */
    skipPostInitInfo: boolean
}

/**
 * Interactively initialize a new instance from CLI args using the base InstanceInitializer class.
 * 
 * After instance initialization, prompt user for pairing
 */
export class InteractiveInstanceInitializer<
    ST extends InstanceStateV1,
    A extends CreateCliArgs
> {

    protected readonly analytics = AnalyticsManager.get()
    private readonly args: InteractiveInstancerInitializerArgs<ST, A>
    private readonly logger = getLogger(InteractiveInstanceInitializer.name)
    private readonly instanceInitializer: InstanceInitializer<ST>

    constructor(args: InteractiveInstancerInitializerArgs<ST, A>){
        this.args = args
        this.instanceInitializer = new InstanceInitializer<ST>({
            stateWriter: this.args.providerClient.getStateWriter(),
            stateParser: this.args.providerClient.getStateParser(),
            provider: this.args.providerClient.getProviderName()
        })
    }

    async initializeInteractive(options?: InstancerInitializationOptions): Promise<void> {
        try {
            this.analyticsEvent("create_instance_start")

            this.logger.debug(`Initializing instance from CLI args ${JSON.stringify(this.args.initArgs)} and options ${JSON.stringify(options)}`)
            
            const input = await this.cliArgsToInput(this.args.initArgs)

            await this.doInitializeState(input.instanceName, input.provision, input.configuration)

            await this.doDeploy(input.instanceName)

            await this.doPair(input.instanceName, this.args.initArgs.skipPairing ?? false, this.args.initArgs.yes ?? false)

            this.showPostInitInfo(options)
            this.analyticsEvent("create_instance_finish")
        } catch (error) {

            if(error instanceof UserVoluntaryInterruptionError){
                console.info("Instance initialization cancelled.")
                this.analyticsEvent("create_instance_user_voluntary_interruption")
                return
            }

            const errMsg = error instanceof Error ? error.message : String(error)
            this.analyticsEvent("create_instance_error", { errorMessage: errMsg })
            throw new Error(`Instance initialization failed`, { cause: error })
        }
    }

    private async cliArgsToInput(cliArgs: A): Promise<InstanceInputs<ST["provision"]["input"], ST["configuration"]["input"]>> {
        this.analyticsEvent("create_instance_start_input_prompt")
        const input = await this.args.inputPrompter.completeCliInput(cliArgs)
        this.analyticsEvent("create_instance_finish_input_prompt")
        return input
    }

    private async doInitializeState(instanceName: string, provisionInput: ST["provision"]["input"], configurationInput: ST["configuration"]["input"]) {
        this.analyticsEvent("create_instance_start_state_init")
        await this.instanceInitializer.initializeStateOnly(instanceName, provisionInput, configurationInput)
        this.analyticsEvent("create_instance_finish_state_init")
    }

    private async doDeploy(instanceName: string) {
        this.analyticsEvent("create_instance_start_deploy")
        const manager = await this.args.providerClient.getInstanceManager(instanceName)
        await manager.deploy()
        this.analyticsEvent("create_instance_finish_deploy")
    }

    private async doPair(instanceName: string, skipPairing: boolean, autoApprove: boolean) {

        const manager = await this.args.providerClient.getInstanceManager(instanceName)

        const doPair = skipPairing ? false : autoApprove ? true : await confirm({
            message: `Your instance is almost ready ! Do you want to pair Moonlight now?`,
            default: true,
        })

        if (doPair) {
            this.analyticsEvent("create_instance_start_pairing")
            this.logger.info(`Initializing ${instanceName}: pairing...}`)
            
            await manager.pairInteractive()
            
            this.analyticsEvent("create_instance_finish_pairing")
            this.logger.info(`Initializing ${instanceName}: pairing done.}`)
        } else {
            this.analyticsEvent("create_instance_skipped_pairing")
            this.logger.info(`Initializing ${instanceName}: pairing skipped.}`)
        }
    }

    private showPostInitInfo(options?: InstancerInitializationOptions) {
        if(!options?.skipPostInitInfo){
            console.info("")
            console.info("Instance has been initialized successfully 🥳")
            console.info("")
            console.info("If you like Cloudy Pad please leave us a star ⭐ https://github.com/PierreBeucher/cloudypad")
            console.info("")
            console.info("🐛 A bug ? Some feedback ? Do not hesitate to file an issue: https://github.com/PierreBeucher/cloudypad/issues")    
        }
    }

    private analyticsEvent(event: string, additionalProperties?: Record<string, any>) {
        this.analytics.sendEvent(event, { 
            provider: this.args.providerClient.getProviderName(), 
            ...additionalProperties 
        })
    }
}
