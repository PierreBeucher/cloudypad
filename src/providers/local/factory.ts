import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { LocalProvisioner } from "./provisioner";
import { LocalInstanceRunner } from "./runner";
import { LocalInstanceStateV1, LocalProvisionInputV1, LocalProvisionOutputV1 } from "./state";
import { CoreConfig } from "../../core/config/interface";
import { AbstractProvisionerFactory, AbstractRunnerFactory } from "../../core/submanager-factory";

export class LocalProvisionerFactory extends AbstractProvisionerFactory<LocalInstanceStateV1> {

    constructor(coreConfig: CoreConfig) {
        super(coreConfig)
    }

    protected async doBuildProvisioner(
        name: string, 
        provisionInput: LocalProvisionInputV1, 
        provisionOutput: LocalProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceProvisioner> {
        return new LocalProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}

export class LocalRunnerFactory extends AbstractRunnerFactory<LocalInstanceStateV1> {

    constructor(coreConfig: CoreConfig) {
        super(coreConfig)
    }

    protected async doBuildRunner(
        name: string, 
        provisionInput: LocalProvisionInputV1, 
        provisionOutput: LocalProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceRunner> {
        return new LocalInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput,
        })
    }
}