import { CLOUDYPAD_PROVIDER } from "./const"
import { CreateCliArgs, InputPrompter } from "./input/prompter"
import { InstanceManagerBuilder } from "./manager-builder"
import { StateInitializer } from "./state/initializer"

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
        
        const input = await this.inputPrompter.completeCliInput(cliArgs)

        const state = await new StateInitializer({
            input: input,
            provider: this.provider,
            overwriteExisting: cliArgs.overwriteExisting
        }).initializeState()
    
        const manager = new InstanceManagerBuilder().buildManagerForState(state)
        await manager.initialize({ 
            autoApprove: cliArgs.autoApprove
        })
    
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