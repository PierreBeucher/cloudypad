import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_GCP } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { GcpInstanceStateV1, GcpStateParser } from "./state"
import { GcpRunnerFactory } from "./factory"
import { GcpProvisionerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type GcpProviderClientArgs = {
    config: CoreConfig
}

export class GcpProviderClient extends AbstractProviderClient<GcpInstanceStateV1> {

    constructor(args: GcpProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_GCP
    }

    getStateParser(): GenericStateParser<GcpInstanceStateV1> {
        return new GcpStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<GcpInstanceStateV1> {
        return new InstanceInitializer<GcpInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new GcpStateParser(),
            provider: CLOUDYPAD_PROVIDER_GCP
        })
    }

    getInstanceUpdater(): InstanceUpdater<GcpInstanceStateV1> {
        return new InstanceUpdater<GcpInstanceStateV1>({
            stateParser: new GcpStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<GcpInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new GcpStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new GcpStateParser()
        const gcpState = parser.parse(state)
        return new GenericInstanceManager<GcpInstanceStateV1>({
            instanceName: gcpState.name,
            provisionerFactory: new GcpProvisionerFactory(this.coreConfig),
            runnerFactory: new GcpRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter()
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<GcpInstanceStateV1> {
        return new StateWriter<GcpInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new GcpStateParser()
        })
    }
} 