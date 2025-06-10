import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_AWS } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import {  InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { AwsInstanceStateV1, AwsStateParser } from "./state"
import { AwsRunnerFactory } from "./factory"
import { AwsProvisionerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type AwsProviderClientArgs = {
    config: CoreConfig
}

export class AwsProviderClient extends AbstractProviderClient<AwsInstanceStateV1> {

    constructor(args: AwsProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_AWS
    }

    getStateParser(): GenericStateParser<AwsInstanceStateV1> {
        return new AwsStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<AwsInstanceStateV1> {
        return new InstanceInitializer<AwsInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new AwsStateParser(),
            provider: CLOUDYPAD_PROVIDER_AWS
        })
    }

    getInstanceUpdater(): InstanceUpdater<AwsInstanceStateV1> {
        return new InstanceUpdater<AwsInstanceStateV1>({
            stateParser: new AwsStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<AwsInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new AwsStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new AwsStateParser()
        const awsState = parser.parse(state)
        return new GenericInstanceManager<AwsInstanceStateV1>({
            instanceName: awsState.name,
            provisionerFactory: new AwsProvisionerFactory(this.coreConfig),
            runnerFactory: new AwsRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter(),
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<AwsInstanceStateV1> {
        return new StateWriter<AwsInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new AwsStateParser()
        })
    }
}
