import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { DummyProvisioner } from "./provisioner";
import { DummyInstanceRunner } from "./runner";
import { DummyConfigurationOutputV1, DummyInstanceStateV1, DummyProvisionInputV1, DummyProvisionOutputV1, DummyStateParser } from "./state";
import { DummyConfigurator } from "./configurator";
import { InstanceConfigurator } from "../../core/configurator";
import { DummyInstanceInfraManager } from "./infra";
import { CoreConfig } from "../../core/config/interface";

export interface DummySubManagerFactoryArgs {
    dummyInfraManager: DummyInstanceInfraManager
    coreConfig: CoreConfig
}

export class DummySubManagerFactory extends AbstractSubManagerFactory<DummyInstanceStateV1> {

    private readonly dummyInfraManager: DummyInstanceInfraManager
    constructor(args: DummySubManagerFactoryArgs){
        super(args.coreConfig)
        this.dummyInfraManager = args.dummyInfraManager
    }

    async doBuildProvisioner(name: string, provisionInput: DummyProvisionInputV1, provisionOutput: DummyProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new DummyProvisioner({
            coreConfig: this.coreConfig,
            dummyInfraManager: this.dummyInfraManager,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(
        name: string, 
        provisionInput: DummyProvisionInputV1, 
        provisionOutput: DummyProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1,
    ): Promise<InstanceRunner> {
        return new DummyInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput,
            dummyInfraManager: this.dummyInfraManager,
        })
    }

    async doBuildConfigurator(name: string, provider: string, provisionInput: DummyProvisionInputV1, provisionOutput: DummyProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceConfigurator> {
        return new DummyConfigurator({ 
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}