import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "../core/const"
import { CreateCliArgs } from "./command"
import { ConfirmationPrompter, InputPrompter, UserVoluntaryInterruptionError } from "./prompter"
import { InstanceManagerBuilder } from "../core/manager-builder"
import { StateInitializer } from "../core/state/initializer"
import { confirm } from '@inquirer/prompts'
import { AnalyticsManager } from "../tools/analytics/manager"
import { CommonConfigurationInputV1, CommonInstanceInput, CommonProvisionInputV1, InstanceInputs } from "../core/state/state"
import { InstanceManager } from "../core/manager"
import { InstanceInitializer } from "../core/initializer"

export interface InteractiveInstancerInitializerArgs<A extends CreateCliArgs, PI extends CommonProvisionInputV1, CI extends CommonConfigurationInputV1> {
    provider: CLOUDYPAD_PROVIDER
    inputPrompter: InputPrompter<A, PI, CI>
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
    A extends CreateCliArgs, 
    PI extends CommonProvisionInputV1, 
    CI extends CommonConfigurationInputV1
> extends InstanceInitializer<PI, CI> {

    protected readonly analytics = AnalyticsManager.get()
    private readonly args: InteractiveInstancerInitializerArgs<A, PI, CI>

    constructor(args: InteractiveInstancerInitializerArgs<A, PI, CI>){
        super({ provider: args.provider })
        this.args = args
    }

    async initializeInteractive(options?: InstancerInitializationOptions): Promise<void> {
        try {
            this.analyticsEvent("create_instance_start")

            
            this.logger.debug(`Initializing instance from CLI args ${JSON.stringify(this.args.initArgs)} and options ${JSON.stringify(options)}`)
            
            const input = await this.cliArgsToInput(this.args.initArgs)

            await this.initializeInstance(input.instanceName, input.provision, input.configuration)

            await this.doPairing(input.instanceName, this.args.initArgs.skipPairing ?? false, this.args.initArgs.yes ?? false)

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

    private async cliArgsToInput(cliArgs: A): Promise<InstanceInputs<PI, CI>> {
        this.analyticsEvent("create_instance_start_input_prompt")
        const input = await this.args.inputPrompter.completeCliInput(cliArgs)
        this.analyticsEvent("create_instance_finish_input_prompt")
        return input
    }

    protected async beforeInitializeState(instanceName: string, provisionInput: CommonProvisionInputV1, configurationInput: CommonConfigurationInputV1) {
        this.analyticsEvent("create_instance_start_state_init")
    }

    protected async afterInitializeState(instanceName: string, provisionInput: CommonProvisionInputV1, configurationInput: CommonConfigurationInputV1) {
        this.analyticsEvent("create_instance_finish_state_init")
    }

    protected async beforeProvisioning(manager: InstanceManager, instanceName: string) {

        const prompter = new ConfirmationPrompter()
        const confirmation = await prompter.confirmCreation(instanceName, await manager.getInputs(), this.args.initArgs.yes)
        if(!confirmation){
            throw new Error('Provision aborted.')
        }

        this.analyticsEvent("create_instance_start_provision")
    }

    protected async afterProvisioning(manager: InstanceManager, instanceName: string) {
        this.analyticsEvent("create_instance_finish_provision")
    }

    protected async beforeConfiguration(manager: InstanceManager, instanceName: string) {
        this.analyticsEvent("create_instance_start_configuration")
    }

    protected async afterConfiguration(manager: InstanceManager, instanceName: string) {
        this.analyticsEvent("create_instance_finish_configuration")
    }

    private async doPairing(instanceName: string, skipPairing: boolean, autoApprove: boolean) {

        const manager = await new InstanceManagerBuilder().buildInstanceManager(instanceName)

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
            provider: this.provider, 
            ...additionalProperties 
        })
    }
}
