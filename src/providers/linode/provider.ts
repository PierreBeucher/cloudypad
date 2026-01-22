import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_LINODE, CLOUDYPAD_PROVIDER } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { LinodeInstanceStateV1, LinodeStateParser } from "./state"
import { LinodeRunnerFactory } from "./factory"
import { LinodeProvisionerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"

export type LinodeProviderClientArgs = {
    config: CoreConfig
}

export class LinodeProviderClient extends AbstractProviderClient<LinodeInstanceStateV1> {

    constructor(args: LinodeProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_LINODE
    }

    getStateParser(): GenericStateParser<LinodeInstanceStateV1> {
        return new LinodeStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<LinodeInstanceStateV1> {
        return new InstanceInitializer<LinodeInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new LinodeStateParser(),
            provider: CLOUDYPAD_PROVIDER_LINODE
        })
    }

    getInstanceUpdater(): InstanceUpdater<LinodeInstanceStateV1> {
        return new InstanceUpdater<LinodeInstanceStateV1>({
            stateParser: new LinodeStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<LinodeInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new LinodeStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    getStateWriter(): StateWriter<LinodeInstanceStateV1> {
        return new StateWriter<LinodeInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new LinodeStateParser()
        })
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new LinodeStateParser()
        const linodeState = parser.parse(state)
        return new GenericInstanceManager<LinodeInstanceStateV1>({
            instanceName: linodeState.name,
            provisionerFactory: new LinodeProvisionerFactory(this.coreConfig),
            runnerFactory: new LinodeRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter(),
            options: {
                // always delete instance server on stop for Linode
                // server would continue to be billed even if instance is stopped
                deleteInstanceServerOnStop: {
                    enable: true,
                }
            }
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }
} 