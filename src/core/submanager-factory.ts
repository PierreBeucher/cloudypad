import { CoreConfig } from "./config/interface"
import { InstanceProvisioner } from "./provisioner"
import { InstanceRunner } from "./runner"
import { InstanceStateV1 } from "./state/state"
import { InstanceConfigurator } from "./configurator"

/**
 * Used by InstanceManager to build sub-managers
 */
export interface ProvisionerFactory<ST extends InstanceStateV1> {
    buildProvisioner(state: ST): Promise<InstanceProvisioner>
}

export interface RunnerFactory<ST extends InstanceStateV1> {
    buildRunner(state: ST): Promise<InstanceRunner>
}

export interface ConfiguratorFactory<ST extends InstanceStateV1, ConfiguratorOptions> {
    buildConfigurator(state: ST, configuratorOptions?: ConfiguratorOptions): Promise<InstanceConfigurator>
}

export abstract class AbstractProvisionerFactory<ST extends InstanceStateV1> implements ProvisionerFactory<ST> {

    protected readonly coreConfig: CoreConfig

    constructor(coreConfig: CoreConfig){
        this.coreConfig = coreConfig
    }

    async buildProvisioner(state: ST): Promise<InstanceProvisioner> {
        return this.doBuildProvisioner(state.name, state.provision.input, state.provision.output, state.configuration.input)
    }

    protected abstract doBuildProvisioner(
        name: string, 
        provisionInput: ST["provision"]["input"], 
        provisionOutput: ST["provision"]["output"],
        configurationInput: ST["configuration"]["input"],
    ): Promise<InstanceProvisioner>
}

export abstract class AbstractRunnerFactory<ST extends InstanceStateV1> implements RunnerFactory<ST> {

    protected readonly coreConfig: CoreConfig

    constructor(coreConfig: CoreConfig){
        this.coreConfig = coreConfig
    }

    async buildRunner(state: ST): Promise<InstanceRunner> {
        if(!state.provision.output){
            throw new Error(`Can't build Instance Runner for ${state.name}: no provision output in state. Was instance fully provisioned ?`)
        }

        return this.doBuildRunner(state.name, state.provision.input, state.provision.output, state.configuration.input)
    }

    protected abstract doBuildRunner(
        name: string, 
        provisionInput: ST["provision"]["input"], 
        provisionOutput: NonNullable<ST["provision"]["output"]>,
        configurationInput: ST["configuration"]["input"],
    ): Promise<InstanceRunner>
}

export abstract class AbstractConfiguratorFactory<ST extends InstanceStateV1, ConfiguratorOptions> {
    async buildConfigurator(state: ST, configuratorOptions?: ConfiguratorOptions): Promise<InstanceConfigurator> {

        if(!state.provision.output) {
            throw new Error("Missing common provision output. Was instance fully initialized ?")
        }

        return this.doBuildConfigurator(
            state.name, 
            state.provision.provider,
            state.provision.input, 
            state.provision.output,
            state.configuration.input,
            configuratorOptions
        )
    }

    abstract doBuildConfigurator(
        name: string,
        provider: string,
        provisionInput: ST["provision"]["input"],
        provisionOutput: NonNullable<ST["provision"]["output"]>,
        configurationInput: ST["configuration"]["input"],
        configuratorOptions?: ConfiguratorOptions
    ): Promise<InstanceConfigurator>
}