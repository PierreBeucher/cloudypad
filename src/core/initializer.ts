import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "../core/const"
import { InstanceManagerBuilder } from "../core/manager-builder"
import { StateInitializer } from "../core/state/initializer"
import { CommonConfigurationInputV1, CommonProvisionInputV1 } from "./state/state"
import { InstanceManager } from "../core/manager"

export interface InstancerInitializerArgs {
    provider: CLOUDYPAD_PROVIDER
}

/**
 * Base class for initializing an instance. Can be extended to add custom steps before and after each step using before* and after* methods.
 */
export class InstanceInitializer<PI extends CommonProvisionInputV1, CI extends CommonConfigurationInputV1> {

    protected readonly provider: CLOUDYPAD_PROVIDER
    protected readonly logger = getLogger(InstanceInitializer.name)

    constructor(args: InstancerInitializerArgs){
        this.provider = args.provider
    }

    /**
     * Initialize an instance using the provided inputs.
     * @param instanceName 
     * @param provisionInput 
     * @param configurationInput 
     */
    async initializeInstance(instanceName: string, provisionInput: PI, configurationInput: CI): Promise<void> {
        
        this.logger.debug(`Initializing instance with provisionInput ${JSON.stringify(provisionInput)} and configurationInput ${JSON.stringify(configurationInput)}`)
        
        await this.beforeInitializeState(instanceName, provisionInput, configurationInput)
        const state = await this.doInitializeState(instanceName, provisionInput, configurationInput)
        await this.afterInitializeState(instanceName, provisionInput, configurationInput)

        const manager = await InstanceManagerBuilder.get().buildInstanceManager(state.name)
        
        await this.beforeProvisioning(manager, state.name)
        await this.doProvisioning(manager, state.name)
        await this.afterProvisioning(manager, state.name)

        await this.beforeConfiguration(manager, state.name)
        await this.doConfiguration(manager, state.name)
        await this.afterConfiguration(manager, state.name)

    }

    protected async beforeInitializeState(instanceName: string, provisionInput: PI, configurationInput: CI){
        // Do nothing by default
    }

    private async doInitializeState(instanceName: string, provisionInput: PI, configurationInput: CI) {
        const state = await new StateInitializer({
            input: {
                instanceName: instanceName,
                provision: provisionInput,
                configuration: configurationInput
            },
            provider: this.provider,
        }).initializeState()
        
        return state
    }

    protected async afterInitializeState(instanceName: string, provisionInput: PI, configurationInput: CI){
        // Do nothing by default
    }

    protected async beforeProvisioning(manager: InstanceManager, instanceName: string, autoApprove?: boolean) {
        // Do nothing by default
    }

    private async doProvisioning(manager: InstanceManager, instanceName: string, autoApprove?: boolean) {
        this.logger.info(`Initializing ${instanceName}: provisioning...`)

        await manager.provision({ autoApprove: autoApprove})
        
        this.logger.info(`Initializing ${instanceName}: provision done.`)
    }

    protected async afterProvisioning(manager: InstanceManager, instanceName: string, autoApprove?: boolean) {
        // Do nothing by default
    }

    protected async beforeConfiguration(manager: InstanceManager, instanceName: string) {
        // Do nothing by default
    }

    private async doConfiguration(manager: InstanceManager, instanceName: string) {
        this.logger.info(`Initializing ${instanceName}: configuring...`)

        await manager.configure()
        
        this.logger.info(`Initializing ${instanceName}: configuration done.`)
    }

    protected async afterConfiguration(manager: InstanceManager, instanceName: string) {
        // Do nothing by default
    }
}
