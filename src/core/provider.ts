import { CoreConfig } from "./config/interface"
import { InstanceInitializer } from "./initializer"
import { InstanceStateV1 } from "./state/state"
import { InstanceUpdater } from "./updater"
import { getLogger, Logger } from "../log/utils"
import { StateWriter } from "./state/writer"
import { StateManagerBuilder } from "./state/builders"
import { InstanceManager } from "./manager"
import { GenericStateParser } from "./state/parser"
import { CLOUDYPAD_PROVIDER } from "./const"
import { StateLoader } from "./state/loader"

export type ProviderClientArgs = {
    config: CoreConfig
}

export abstract class AbstractProviderClient<ST extends InstanceStateV1> {
    protected logger: Logger
    protected readonly coreConfig: CoreConfig
    protected stateManagerBuilder: StateManagerBuilder

    constructor(args: ProviderClientArgs) {
        this.logger = getLogger(AbstractProviderClient.name)
        this.coreConfig = args.config
        this.stateManagerBuilder = this.buildStateManagerBuilder()
    }

    private buildStateManagerBuilder(): StateManagerBuilder {
        return new StateManagerBuilder({
            stateBackend: {
                local: this.coreConfig.stateBackend.local,
                s3: this.coreConfig.stateBackend.s3
            }
        })
    }

    abstract getProviderName(): CLOUDYPAD_PROVIDER

    abstract getInstanceInitializer(): InstanceInitializer<ST>

    abstract getInstanceUpdater(): InstanceUpdater<ST>

    abstract getInstanceState(instanceName: string): Promise<ST>

    abstract getStateWriter(): StateWriter<ST>

    abstract getStateParser(): GenericStateParser<ST>

    abstract getInstanceManager(instanceName: string): Promise<InstanceManager>

    getStateLoader(): StateLoader {
        return this.buildStateManagerBuilder().buildStateLoader()
    }

    /**
     * Get an instance manager for a given generic instance state.
     * 
     * This method is used to get an instance manager for a given instance state without knowing the provider.
     * It will parse the state into a provider specific state and get the provider from the state.
     * Passed state must match the provider type.
     * 
     * @param state instance state
     * @returns instance manager
     */
    abstract getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager>
}
