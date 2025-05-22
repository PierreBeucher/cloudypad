import { getLogger } from '../log/utils';
import { InstanceManager } from './manager';
import { StateLoader } from './state/loader';
import { CommonProvisionInputV1, CommonConfigurationInputV1, InstanceStateV1 } from './state/state';
import { CLOUDYPAD_PROVIDER, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_LOCAL, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE, CLOUDYPAD_PROVIDER_SCALEWAY } from './const';
import { AwsSubManagerFactory } from '../providers/aws/factory';
import { GcpSubManagerFactory } from '../providers/gcp/factory';
import { AzureSubManagerFactory } from '../providers/azure/factory';
import { PaperspaceSubManagerFactory } from '../providers/paperspace/factory';
import { GenericInstanceManager } from './manager';
import { AwsStateParser } from '../providers/aws/state';
import { AzureStateParser } from '../providers/azure/state';
import { GcpStateParser } from '../providers/gcp/state';
import { PaperspaceStateParser } from '../providers/paperspace/state';
import { LocalStateParser } from '../providers/local/state';
import { LocalSubManagerFactory } from '../providers/local/factory';
import { ScalewaySubManagerFactory } from '../providers/scaleway/factory';
import { ScalewayStateParser } from '../providers/scaleway/state';
import { StateManagerBuilder } from './state/builders';
import { CoreConfig } from './config/interface';
import { StateWriter } from './state/writer';
import { InstanceInitializer } from './initializer';
import { InstanceUpdater } from './updater';
import { GenericStateParser } from './state/parser';
import { LocalInstanceInfraManager } from '../providers/local/infra';

// This is the global config !
export interface CloudypadClientArgs {
    config: CoreConfig
}

/**
 * Build InstanceManager from state. This is the main entry point for InstanceManager instantiation.
 * 
 * To Build an InstanceManager, related provider for State must be registered first using registerProvider().
 * Cloudy Pad Core providers are already registered, but more custom providers can be registered.
 */
export class CloudypadClient {

    private readonly registeredProviders = new Map<string, (state: InstanceStateV1) => Promise<InstanceManager>>()
    private readonly args: CloudypadClientArgs

    private readonly logger = getLogger(CloudypadClient.name)

    private readonly stateManagerBuilder: StateManagerBuilder

    constructor(args: CloudypadClientArgs) {
        if (args.config.stateBackend.s3 && args.config.stateBackend.local || !args.config.stateBackend.s3 && !args.config.stateBackend.local) {
            throw new Error("Exactly one of s3 or local data backend must be provided, got: " + JSON.stringify(args.config.stateBackend))
        }

        this.args = args
        this.registeredProviders = new Map<string, (state: InstanceStateV1) => Promise<InstanceManager>>()
        this.initializeRegisteredProviders()
        this.stateManagerBuilder = this.buildStateManagerBuilder()
    }

    /**
     * Register a provider with the given name and InstanceManager builder function
     * On InstanceManager instantiation from state, only registered managers will be able to handle state. 
     * 
     * Appart from Core providers, more custom Providers can be registered this way.
     * 
     * @param providerName provider name, eg. "aws"
     * @param buildManagerFunction function that will build an InstanceManager for given provider
     */
    registerProvider(providerName: string, buildManagerFunction: (state: InstanceStateV1) => Promise<InstanceManager>) {
        this.registeredProviders.set(providerName, buildManagerFunction)
    }

    private buildStateManagerBuilder(): StateManagerBuilder {
        return new StateManagerBuilder({
            stateBackend: {
                local: this.args.config.stateBackend.local,
                s3: this.args.config.stateBackend.s3
            }
        })
    }

    private initializeRegisteredProviders() {

        this.registerProvider(CLOUDYPAD_PROVIDER_AWS, async (state: InstanceStateV1) => {
            const awsState = new AwsStateParser().parse(state)
            return new GenericInstanceManager({
                stateWriter: this.stateManagerBuilder.buildStateWriter(awsState),
                factory: new AwsSubManagerFactory(this.args.config)
            })
        })

        this.registerProvider(CLOUDYPAD_PROVIDER_AZURE, async (state: InstanceStateV1) => {
            const azureState = new AzureStateParser().parse(state)
            return new GenericInstanceManager({
                stateWriter: this.stateManagerBuilder.buildStateWriter(azureState),
                factory: new AzureSubManagerFactory(this.args.config)
            })
        })

        this.registerProvider(CLOUDYPAD_PROVIDER_GCP, async (state: InstanceStateV1) => {
            const gcpState = new GcpStateParser().parse(state)
            return new GenericInstanceManager({
                stateWriter: this.stateManagerBuilder.buildStateWriter(gcpState),
                factory: new GcpSubManagerFactory(this.args.config)
            })
        })

        this.registerProvider(CLOUDYPAD_PROVIDER_PAPERSPACE, async (state: InstanceStateV1) => {
            const paperspaceState = new PaperspaceStateParser().parse(state)
            return new GenericInstanceManager({
                stateWriter: this.stateManagerBuilder.buildStateWriter(paperspaceState),
                factory: new PaperspaceSubManagerFactory(this.args.config)
            })
        })

        this.registerProvider(CLOUDYPAD_PROVIDER_SCALEWAY, async (state: InstanceStateV1) => {
            const scalewayState = new ScalewayStateParser().parse(state)
            return new GenericInstanceManager({
                stateWriter: this.stateManagerBuilder.buildStateWriter(scalewayState),
                factory: new ScalewaySubManagerFactory(this.args.config)
            })
        })

        // local provider needs an additional LocalInstanceInfraManager to emulate
        // actions when instance is provisioned and started/stopped, etc. 
        this.registerProvider(CLOUDYPAD_PROVIDER_LOCAL, async (state: InstanceStateV1) => {
            const localState = new LocalStateParser().parse(state)
            const stateWriter = this.stateManagerBuilder.buildStateWriter(localState)
            const localInfraManager = new LocalInstanceInfraManager({
                instanceName: localState.name
            })
            return new GenericInstanceManager({
                stateWriter: stateWriter,
                factory: new LocalSubManagerFactory({
                    coreConfig: this.args.config,
                    localInfraManager: localInfraManager
                })
            })
        })
    }

    async getAllInstances(): Promise<string[]> {
        const loader = this.buildStateManagerBuilder().buildStateLoader()
        return loader.listInstances()
    }

    private async loadAnonymousState(instanceName: string): Promise<InstanceStateV1>{
        const loader = this.buildStateManagerBuilder().buildStateLoader()
        const state = await loader.loadInstanceState(instanceName)
        return state
    }

    /**
     * Build an InstanceManager for given state. Infer provider name from state and
     * use a registered provider to build the InstanceManager.
     * @param name instance name
     * @returns InstanceManager
     */
    async buildInstanceManager(name: string): Promise<InstanceManager>{
        const state = await this.loadAnonymousState(name)
        const provider = state.provision.provider

        this.logger.info(`Building InstanceManager for provider '${provider}'.`)

        const buildManagerFunction = this.registeredProviders.get(provider)
        if (!buildManagerFunction) {
            throw new Error(`Unknown provider '${provider}' in state: ${JSON.stringify(state)}`)
        }

        return buildManagerFunction(state)
    }

    /**
     * Build an InstanceInitializer for given provider.
     * @param provider provider name
     * @returns InstanceInitializer
     */
    buildInstanceInitializer<
        PI extends CommonProvisionInputV1, 
        CI extends CommonConfigurationInputV1
    >(provider: CLOUDYPAD_PROVIDER): InstanceInitializer<PI, CI> {
        return new InstanceInitializer<PI, CI>({
            stateWriter: this.buildEmptyStateWriter(),
            provider: provider
        })
    }

    buildInstanceUpdater<ST extends InstanceStateV1>(stateParser: GenericStateParser<ST>): InstanceUpdater<ST> {
        return new InstanceUpdater<ST>({
            stateParser: stateParser,
            stateWriter: this.buildEmptyStateWriter(),
            stateLoader: this.buildStateLoader()
        })
    }

    /**
     * Build a StateLoader from the builder configuration.
     * @returns StateLoader
     */
    buildStateLoader(): StateLoader {
        return this.buildStateManagerBuilder().buildStateLoader()
    }
    
    /**
     * Build a StateWriter from the builder configuration.
     * @param state InstanceStateV1
     * @returns StateWriter
     */
    buildStateWriterFor<ST extends InstanceStateV1>(state: ST): StateWriter<ST> {
        return this.buildStateManagerBuilder().buildStateWriter(state)
    }

    buildEmptyStateWriter<ST extends InstanceStateV1>(): StateWriter<ST> {
        return this.buildStateManagerBuilder().buildStateWriter()
    }
}
