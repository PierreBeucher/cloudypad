import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_SSH } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { SshInstanceStateV1, SshStateParser } from "./state"
import { SshProvisionerFactory, SshRunnerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type SshProviderClientArgs = {
    config: CoreConfig
}

export class SshProviderClient extends AbstractProviderClient<SshInstanceStateV1> {

    constructor(args: SshProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_SSH
    }

    getStateParser(): GenericStateParser<SshInstanceStateV1> {
        return new SshStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<SshInstanceStateV1> {
        return new InstanceInitializer<SshInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new SshStateParser(),
            provider: CLOUDYPAD_PROVIDER_SSH
        })
    }

    getInstanceUpdater(): InstanceUpdater<SshInstanceStateV1> {
        return new InstanceUpdater<SshInstanceStateV1>({
            stateParser: new SshStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<SshInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new SshStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new SshStateParser()
        const localState = parser.parse(state)
        return new GenericInstanceManager<SshInstanceStateV1>({
            instanceName: localState.name,
            provisionerFactory: new SshProvisionerFactory(this.coreConfig),
            runnerFactory: new SshRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter(),
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<SshInstanceStateV1> {
        return new StateWriter<SshInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new SshStateParser()
        })
    }
} 