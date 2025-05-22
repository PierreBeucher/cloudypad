import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { LocalProvisioner } from "./provisioner";
import { LocalInstanceRunner } from "./runner";
import { LocalConfigurationOutputV1, LocalInstanceStateV1, LocalProvisionInputV1, LocalProvisionOutputV1, LocalStateParser } from "./state";
import { InstanceConfigurator } from "../../core/configurator";
import { LocalInstanceInfraManager } from "./infra";
import { CoreConfig } from "../../core/config/interface";
import { AnsibleConfigurator } from "../../configurators/ansible";

export interface LocalSubManagerFactoryArgs {
    localInfraManager: LocalInstanceInfraManager
    coreConfig: CoreConfig
}

export class LocalSubManagerFactory extends AbstractSubManagerFactory<LocalInstanceStateV1> {

    private readonly localInfraManager: LocalInstanceInfraManager
    constructor(args: LocalSubManagerFactoryArgs){
        super(args.coreConfig)
        this.localInfraManager = args.localInfraManager
    }

    async doBuildProvisioner(name: string, provisionInput: LocalProvisionInputV1, provisionOutput: LocalProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new LocalProvisioner({
            coreConfig: this.coreConfig,
            localInfraManager: this.localInfraManager,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(
        name: string, 
        provisionInput: LocalProvisionInputV1, 
        provisionOutput: LocalProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1,
    ): Promise<InstanceRunner> {
        return new LocalInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput,
            localInfraManager: this.localInfraManager,
        })
    }

    async doBuildConfigurator(name: string, provider: string, provisionInput: LocalProvisionInputV1, provisionOutput: LocalProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceConfigurator> {
        return new AnsibleConfigurator({ 
            instanceName: name,
            provider: provider,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}