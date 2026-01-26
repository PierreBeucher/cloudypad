import { InteractiveInstanceInitializer } from "../../cli/initializer"
import { CLOUDYPAD_PROVIDER_DUMMY, CLOUDYPAD_PROVIDER } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { InstanceManager } from "../../core/manager"
import { GenericInstanceManager } from "../../core/manager"
import { AbstractProviderClient, ProviderClientArgs } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { DummyRunnerFactory } from "./factory"
import { DummyCreateCliArgs, DummyInputPrompter } from "./cli"
import { DummyProvisionerFactory } from "./factory"
import { DummyConfiguratorFactory } from "./factory"
import { DummyInstanceInfraManager } from "./infra"
import { DummyInstanceStateV1, DummyProvisionInputV1, DummyStateParser } from "./state"
import { GenericStateParser } from "../../core/state/parser"
import { StateLoader } from "../../core/state/loader"

export class DummyProviderClient extends AbstractProviderClient<DummyInstanceStateV1> {

    constructor(args: ProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_DUMMY
    }
    
    getStateParser(): GenericStateParser<DummyInstanceStateV1> {
        return new DummyStateParser()
    }
    
    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new DummyStateParser()
        const dummyState = parser.parse(state)
        const stateWriter = this.getStateWriter()
        const dummyInfraManager = new DummyInstanceInfraManager({
            instanceName: dummyState.name,
            coreConfig: this.coreConfig
        })

        return new GenericInstanceManager<DummyInstanceStateV1>({
            instanceName: dummyState.name,
            provisionerFactory: new DummyProvisionerFactory({
                coreConfig: this.coreConfig,
                dummyInfraManager: dummyInfraManager
            }),
            runnerFactory: new DummyRunnerFactory({
                coreConfig: this.coreConfig,
                dummyInfraManager: dummyInfraManager
            }),
            configuratorFactory: new DummyConfiguratorFactory(),  
            stateWriter: stateWriter,
        })
    }
    
    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getInstanceInitializer(): InstanceInitializer<DummyInstanceStateV1> {
        return new InstanceInitializer<DummyInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new DummyStateParser(),
            provider: CLOUDYPAD_PROVIDER_DUMMY
        })
    }

    getInstanceUpdater(): InstanceUpdater<DummyInstanceStateV1> {
        return new InstanceUpdater<DummyInstanceStateV1>({
            stateLoader: this.stateManagerBuilder.buildStateLoader(),
            stateWriter: this.getStateWriter(),
            stateParser: new DummyStateParser()
        })
    }

    async getInstanceState(instanceName: string): Promise<DummyInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new DummyStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    getStateWriter(): StateWriter<DummyInstanceStateV1> {
        return new StateWriter<DummyInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new DummyStateParser()
        })
    }

    getStateLoader(): StateLoader {
        return this.getInstanceUpdater().getStateLoader()
    }

}