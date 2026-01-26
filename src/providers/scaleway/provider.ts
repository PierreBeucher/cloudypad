import { objectOutputType, objectUtil, ZodString, ZodOptional, ZodTypeAny, ZodDefault, ZodBoolean } from "zod"
import { InteractiveInstanceInitializer } from "../../cli/initializer"
import { CloudypadClient } from "../../core/client"
import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_SCALEWAY } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { GenericInstanceManager, InstanceManager } from "../../core/manager"
import { AbstractProviderClient } from "../../core/provider"
import { CommonConfigurationInputV1, InstanceEventEnum, InstanceStateV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { ScalewayCreateCliArgs, ScalewayInputPrompter } from "./cli"
import { ScalewayInstanceStateV1, ScalewayProvisionInputV1, ScalewayStateParser } from "./state"
import { ScalewayRunnerFactory } from "./factory"
import { ScalewayProvisionerFactory } from "./factory"
import { AnsibleConfiguratorFactory } from "../../configurators/ansible"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER } from "../../core/const"

export type ScalewayProviderClientArgs = {
    config: CoreConfig
}

export class ScalewayProviderClient extends AbstractProviderClient<ScalewayInstanceStateV1> {

    constructor(args: ScalewayProviderClientArgs) {
        super(args)
    }

    getProviderName(): CLOUDYPAD_PROVIDER {
        return CLOUDYPAD_PROVIDER_SCALEWAY
    }

    getStateParser(): GenericStateParser<ScalewayInstanceStateV1> {
        return new ScalewayStateParser()
    }

    getInstanceInitializer(): InstanceInitializer<ScalewayInstanceStateV1> {
        return new InstanceInitializer<ScalewayInstanceStateV1>({
            stateWriter: this.getStateWriter(),
            stateParser: new ScalewayStateParser(),
            provider: CLOUDYPAD_PROVIDER_SCALEWAY
        })
    }

    getInstanceUpdater(): InstanceUpdater<ScalewayInstanceStateV1> {
        return new InstanceUpdater<ScalewayInstanceStateV1>({
            stateParser: new ScalewayStateParser(),
            stateWriter: this.getStateWriter(),
            stateLoader: this.stateManagerBuilder.buildStateLoader()
        })
    }

    async getInstanceState(instanceName: string): Promise<ScalewayInstanceStateV1> {
        const loader = this.stateManagerBuilder.buildStateLoader()
        const parser = new ScalewayStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    async getInstanceManagerFor(state: InstanceStateV1): Promise<InstanceManager> {
        const parser = new ScalewayStateParser()
        const scalewayState = parser.parse(state)
        return new GenericInstanceManager<ScalewayInstanceStateV1>({
            instanceName: scalewayState.name,
            provisionerFactory: new ScalewayProvisionerFactory(this.coreConfig),
            runnerFactory: new ScalewayRunnerFactory(this.coreConfig),
            configuratorFactory: new AnsibleConfiguratorFactory(),
            stateWriter: this.getStateWriter(),
        })
    }

    async getInstanceManager(instanceName: string): Promise<InstanceManager> {
        const state = await this.getInstanceState(instanceName)
        return this.getInstanceManagerFor(state)
    }

    getStateWriter(): StateWriter<ScalewayInstanceStateV1> {
        return new StateWriter<ScalewayInstanceStateV1>({
            sideEffect: this.stateManagerBuilder.buildSideEffect(),
            stateParser: new ScalewayStateParser()
        })
    }
}