import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_AZURE } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { AzureInstanceStateV1, AzureStateParser } from "./state"
import { AzureRunnerFactory } from "./factory"
import { AzureProvisionerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type AzureProviderClientArgs = {
    config: CoreConfig
}

export class AzureProviderClient extends AbstractProviderClient<AzureInstanceStateV1> {

    constructor(args: AzureProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_AZURE
    }

    getStateParser(): GenericStateParser<AzureInstanceStateV1> {
        return new AzureStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<AzureInstanceStateV1> {
        return new InstanceInitializer<AzureInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new AzureStateParser(),
            provider: CLOUDYPAD_PROVIDER_AZURE
        })
    }

    getInstanceUpdater(): InstanceUpdater<AzureInstanceStateV1> {
        return new InstanceUpdater<AzureInstanceStateV1>({
            stateParser: new AzureStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<AzureInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new AzureStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new AzureStateParser()
        const azureState = parser.parse(state)
        return new GenericInstanceManager<AzureInstanceStateV1>({
            instanceName: azureState.name,
            provisionerFactory: new AzureProvisionerFactory(this.coreConfig),
            runnerFactory: new AzureRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter()
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<AzureInstanceStateV1> {
        return new StateWriter<AzureInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new AzureStateParser()
        })
    }
} 