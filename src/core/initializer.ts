import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "./const"
import { CreateCliArgs } from "./input/cli"
import { InputPrompter } from "./input/prompter"
import { InstanceManagerBuilder } from "./manager-builder"
import { StateInitializer } from "./state/initializer"
import { confirm } from '@inquirer/prompts';
import { StateLoader } from "./state/loader"

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

        const loader = new StateLoader()
        if(await loader.instanceExists(input.instanceName) && !cliArgs.overwriteExisting){
            const confirmAlreadyExists = await confirm({
                message: `Instance ${input.instanceName} already exists. Do you want to overwrite existing instance config?`,
                default: false,
            })
            
            if (!confirmAlreadyExists) {
                throw new Error("Won't overwrite existing instance. Initialization aborted.")
            }
        }

        const state = new StateInitializer({
            input: input,
            provider: this.provider,
        }).initializeState()
    
        const manager = new InstanceManagerBuilder().buildManagerForState(state)
        const instanceName = state.name
        const autoApprove =  cliArgs.yes

        this.logger.info(`Initializing ${instanceName}: provisioning...`)

        await manager.provision({ autoApprove: autoApprove})

        this.logger.info(`Initializing ${instanceName}: provision done.}`)

        this.logger.info(`Initializing ${instanceName}: configuring...}`)
        
        await manager.configure()

        this.logger.info(`Initializing ${instanceName}: configuration done.}`)

        const doPair = autoApprove ? true : await confirm({
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