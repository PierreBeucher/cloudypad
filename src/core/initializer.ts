import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "./const"
import { CreateCliArgs } from "./cli/command"
import { InputPrompter } from "./cli/prompter"
import { InstanceManagerBuilder } from "./manager-builder"
import { StateInitializer } from "./state/initializer"
import { confirm } from '@inquirer/prompts'

export interface InstancerInitializerArgs {
    provider: CLOUDYPAD_PROVIDER
    inputPrompter: InputPrompter
}

export interface InstancerInitializationOptions {

    /**
     * Whether to show post-initialization message on console.
     */
    skipPostInitInfo: boolean
}

/**
 * Initialize a new instance from CLI args. Create a new State and persist to disk before and build an InstanceManager.
 */
export class InteractiveInstanceInitializer {

    private readonly provider: CLOUDYPAD_PROVIDER
    private readonly inputPrompter: InputPrompter
    private readonly logger = getLogger(InteractiveInstanceInitializer.name)

    constructor(args: InstancerInitializerArgs){
        this.provider = args.provider
        this.inputPrompter = args.inputPrompter
    }

    /**
     * Interactively initialize a new instance from CLI args:
     * - Parse CLI args into known Input interface
     * - Interactively prompt for missing args
     * - Run instance initialization
     */
    async initializeInstance(cliArgs: CreateCliArgs, options?: InstancerInitializationOptions): Promise<void> {

        this.logger.debug(`Initializing instance from CLI args ${JSON.stringify(cliArgs)} and options ${JSON.stringify(options)}`)
        
        const input = await this.inputPrompter.completeCliInput(cliArgs)

        const state = await new StateInitializer({
            input: input,
            provider: this.provider,
        }).initializeState()
    
        const manager = await new InstanceManagerBuilder().buildInstanceManager(state.name)
        const instanceName = state.name
        const autoApprove =  cliArgs.yes

        this.logger.info(`Initializing ${instanceName}: provisioning...`)

        await manager.provision({ autoApprove: autoApprove})

        this.logger.info(`Initializing ${instanceName}: provision done.}`)

        this.logger.info(`Initializing ${instanceName}: configuring...}`)
        
        await manager.configure()

        this.logger.info(`Initializing ${instanceName}: configuration done.}`)

        const doPair = cliArgs?.skipPairing ? false : autoApprove ? true : await confirm({
            message: `Your instance is almost ready ! Do you want to pair Moonlight now?`,
            default: true,
        })

        if (doPair) {
            this.logger.info(`Initializing ${instanceName}: pairing...}`)

            await manager.pair()
    
            this.logger.info(`Initializing ${instanceName}: pairing done.}`)
        } else {
            this.logger.info(`Initializing ${instanceName}: pairing skipped.}`)
        }
    
        if(!options?.skipPostInitInfo){
            console.info("")
            console.info("Instance has been initialized successfully 🥳")
            console.info("")
            console.info("If you like Cloudy Pad please leave us a star ⭐ https://github.com/PierreBeucher/cloudypad")
            console.info("")
            console.info("🐛 A bug ? Some feedback ? Do not hesitate to file an issue: https://github.com/PierreBeucher/cloudypad/issues")    
        }
        
    }
}