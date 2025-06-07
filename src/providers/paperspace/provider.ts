import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_PAPERSPACE } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { PaperspaceInstanceStateV1, PaperspaceStateParser } from "./state"
import { PaperspaceRunnerFactory } from "./factory"
import { PaperspaceProvisionerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type PaperspaceProviderClientArgs = {
    config: CoreConfig
}

export class PaperspaceProviderClient extends AbstractProviderClient<PaperspaceInstanceStateV1> {

    constructor(args: PaperspaceProviderClientArgs) {
        super(args)
    }

    getProvider(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_PAPERSPACE
    }

    getStateParser(): GenericStateParser<PaperspaceInstanceStateV1> {
        return new PaperspaceStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<PaperspaceInstanceStateV1> {
        return new InstanceInitializer<PaperspaceInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new PaperspaceStateParser(),
            provider: CLOUDYPAD_PROVIDER_PAPERSPACE
        })
    }

    getInstanceUpdater(): InstanceUpdater<PaperspaceInstanceStateV1> {
        return new InstanceUpdater<PaperspaceInstanceStateV1>({
            stateParser: new PaperspaceStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<PaperspaceInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new PaperspaceStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new PaperspaceStateParser()
        const paperspaceState = parser.parse(state)
        return new GenericInstanceManager<PaperspaceInstanceStateV1>({
            instanceName: paperspaceState.name,
            provisionerFactory: new PaperspaceProvisionerFactory(this.coreConfig),
            runnerFactory: new PaperspaceRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter()
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<PaperspaceInstanceStateV1> {
        return new StateWriter<PaperspaceInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new PaperspaceStateParser()
        })
    }
} 