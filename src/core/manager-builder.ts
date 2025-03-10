import { getLogger } from '../log/utils';
import { InstanceManager } from './manager';
import { StateLoader } from './state/loader';
import { InstanceStateV1 } from './state/state';
import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_DUMMY, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE, CLOUDYPAD_PROVIDER_SCALEWAY } from './const';
import { AwsSubManagerFactory } from '../providers/aws/factory';
import { GcpSubManagerFactory } from '../providers/gcp/factory';
import { AzureSubManagerFactory } from '../providers/azure/factory';
import { PaperspaceSubManagerFactory } from '../providers/paperspace/factory';
import { GenericInstanceManager } from './manager';
import { StateWriter } from './state/writer';
import { AwsStateParser } from '../providers/aws/state';
import { AzureStateParser } from '../providers/azure/state';
import { GcpStateParser } from '../providers/gcp/state';
import { PaperspaceStateParser } from '../providers/paperspace/state';
import { DummyStateParser } from '../providers/dummy/state';
import { DummySubManagerFactory } from '../providers/dummy/factory';
import { ScalewaySubManagerFactory } from '../providers/scaleway/factory';
import { ScalewayStateParser } from '../providers/scaleway/state';


/**
 * Register a provider with the given name and InstanceManager builder function
 * On InstanceManager instantiation from state, only registered managers will be able to handle state. 
 * 
 * Appart from Core providers, more custom Providers can be registered this way.
 * 
 * @param providerName provider name, eg. "aws"
 * @param buildManagerFunction function that will build an InstanceManager for given provider
 */
export async function registerProvider(providerName: string, buildManagerFunction: (state: InstanceStateV1) => Promise<InstanceManager>) {
    InstanceManagerBuilder.get().registerProvider(providerName, buildManagerFunction)
}

/**
 * Initialize InstanceManagerBuildeer by registering all Core providers
 */
function initializeInstanceManagerBuilder() {
    registerProvider(CLOUDYPAD_PROVIDER_AWS, async (state: InstanceStateV1) => {
        const awsState = new AwsStateParser().parse(state)
        return new GenericInstanceManager({
            stateWriter: new StateWriter({ state: awsState }),
            factory: new AwsSubManagerFactory()
        })
    })
    
    registerProvider(CLOUDYPAD_PROVIDER_AZURE, async (state: InstanceStateV1) => {
        const azureState = new AzureStateParser().parse(state)
        return new GenericInstanceManager({
            stateWriter: new StateWriter({ state: azureState }),
            factory: new AzureSubManagerFactory()
        })
    })
    
    registerProvider(CLOUDYPAD_PROVIDER_GCP, async (state: InstanceStateV1) => {
        const gcpState = new GcpStateParser().parse(state)
        return new GenericInstanceManager({
            stateWriter: new StateWriter({ state: gcpState }),
            factory: new GcpSubManagerFactory()
        })
    })
    
    registerProvider(CLOUDYPAD_PROVIDER_PAPERSPACE, async (state: InstanceStateV1) => {
        const paperspaceState = new PaperspaceStateParser().parse(state)
        return new GenericInstanceManager({
            stateWriter: new StateWriter({ state: paperspaceState }),
            factory: new PaperspaceSubManagerFactory()
        })
    })

    registerProvider(CLOUDYPAD_PROVIDER_SCALEWAY, async (state: InstanceStateV1) => {
        const scalewayState = new ScalewayStateParser().parse(state)
        return new GenericInstanceManager({
            stateWriter: new StateWriter({ state: scalewayState }),
            factory: new ScalewaySubManagerFactory()
        })
    })
    
    registerProvider(CLOUDYPAD_PROVIDER_DUMMY, async (state: InstanceStateV1) => {
        const dummyState = new DummyStateParser().parse(state)
        return new GenericInstanceManager({
            stateWriter: new StateWriter({ state: dummyState }),
            factory: new DummySubManagerFactory()
        })
    })
}

/**
 * Build InstanceManager from state. This is the main entry point for InstanceManager instantiation.
 * 
 * To Build an InstanceManager, related provider for State must be registered first using registerProvider().
 * Cloudy Pad Core providers are already registered, but more custom providers can be registered.
 */
export class InstanceManagerBuilder {

    private static instance: InstanceManagerBuilder;

    public static get(): InstanceManagerBuilder {
        if (!InstanceManagerBuilder.instance) {
            InstanceManagerBuilder.instance = new InstanceManagerBuilder()
            initializeInstanceManagerBuilder()
        }
        return InstanceManagerBuilder.instance;
    }

    private readonly registeredProviders = new Map<string, (state: InstanceStateV1) => Promise<InstanceManager>>()

    private readonly logger = getLogger(InstanceManagerBuilder.name)

    private constructor() {
        this.registeredProviders = new Map<string, (state: InstanceStateV1) => Promise<InstanceManager>>()
    }

    getAllInstances(): string[] {
        return new StateLoader().listInstances()
    }

    /**
     * See exported registerProvider()
     */
    public registerProvider(providerName: string, buildManagerFunction: (state: InstanceStateV1) => Promise<InstanceManager>) {
        this.registeredProviders.set(providerName, buildManagerFunction)
    }

    private async loadAnonymousState(instanceName: string): Promise<InstanceStateV1>{
        const state = await new StateLoader().loadAndMigrateInstanceState(instanceName)
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

        this.logger.info(`Building InstanceManager for provider '${provider}'`)

        const buildManagerFunction = this.registeredProviders.get(provider)
        if (!buildManagerFunction) {
            throw new Error(`Unknown provider '${provider}' in state: ${JSON.stringify(state)}`)
        }

        return buildManagerFunction(state)
    }
}
