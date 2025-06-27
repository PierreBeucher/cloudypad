import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_LOCAL } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { LocalInstanceStateV1, LocalStateParser } from "./state"
import { LocalProvisionerFactory, LocalRunnerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type LocalProviderClientArgs = {
    config: CoreConfig
}

export class LocalProviderClient extends AbstractProviderClient<LocalInstanceStateV1> {

    constructor(args: LocalProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_LOCAL
    }

    getStateParser(): GenericStateParser<LocalInstanceStateV1> {
        return new LocalStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<LocalInstanceStateV1> {
        return new InstanceInitializer<LocalInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new LocalStateParser(),
            provider: CLOUDYPAD_PROVIDER_LOCAL
        })
    }

    getInstanceUpdater(): InstanceUpdater<LocalInstanceStateV1> {
        return new InstanceUpdater<LocalInstanceStateV1>({
            stateParser: new LocalStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<LocalInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new LocalStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new LocalStateParser()
        const localState = parser.parse(state)
        return new GenericInstanceManager<LocalInstanceStateV1>({
            instanceName: localState.name,
            provisionerFactory: new LocalProvisionerFactory(this.coreConfig),
            runnerFactory: new LocalRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter(),
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<LocalInstanceStateV1> {
        return new StateWriter<LocalInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new LocalStateParser()
        })
    }
} 