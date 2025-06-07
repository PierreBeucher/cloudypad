import { InstanceManager } from "./manager";
import { CoreConfig } from "./config/interface";
import { StateManagerBuilder } from "./state/builders";
import { StateLoader } from "./state/loader";
import { InstanceStateV1 } from "./state/state";
import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_DUMMY, CLOUDYPAD_PROVIDER_SCALEWAY } from "./const";
import { CLOUDYPAD_PROVIDER_AZURE } from "./const";
import { ScalewayProviderClient } from "../providers/scaleway/provider";
import { DummyProviderClient } from "../providers/dummy/provider";

export interface InstanceManagerBuilderArgs {
    config: CoreConfig
}

export class InstanceManagerBuilder {   

    private readonly config: CoreConfig
    private readonly stateManagerBuilder: StateManagerBuilder
    private readonly stateLoader: StateLoader

    constructor(args: InstanceManagerBuilderArgs) {
        this.config = args.config
        this.stateManagerBuilder = new StateManagerBuilder({
            stateBackend: {
                local: this.config.stateBackend.local,
                s3: this.config.stateBackend.s3
            }
        })
        this.stateLoader = this.stateManagerBuilder.buildStateLoader()
    }

    async buildInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.stateLoader.loadInstanceState(instanceName)
        const providerClient = state.provision.provider

        switch(providerClient){
            case CLOUDYPAD_PROVIDER_SCALEWAY:
                const scalewayProviderClient = new ScalewayProviderClient({ config: this.config })
                return scalewayProviderClient.getInstanceManagerFor(state)
            case CLOUDYPAD_PROVIDER_DUMMY:
                const dummyProviderClient = new DummyProviderClient({ config: this.config })
                return dummyProviderClient.getInstanceManagerFor(state)
            default:
                throw new Error(`Provider ${providerClient} not supported`)
        }
    }
}
