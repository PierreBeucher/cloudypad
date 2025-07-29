import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { SshProvisioner } from "./provisioner";
import { SshInstanceRunner } from "./runner";
import { SshInstanceStateV1, SshProvisionInputV1, SshProvisionOutputV1 } from "./state";
import { CoreConfig } from "../../core/config/interface";
import { AbstractProvisionerFactory, AbstractRunnerFactory } from "../../core/submanager-factory";

export class SshProvisionerFactory extends AbstractProvisionerFactory<SshInstanceStateV1> {

    constructor(coreConfig: CoreConfig) {
        super(coreConfig)
    }

    protected async doBuildProvisioner(
        name: string, 
        provisionInput: SshProvisionInputV1, 
        provisionOutput: SshProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceProvisioner> {
        return new SshProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}

export class SshRunnerFactory extends AbstractRunnerFactory<SshInstanceStateV1> {

    constructor(coreConfig: CoreConfig) {
        super(coreConfig)
    }

    protected async doBuildRunner(
        name: string, 
        provisionInput: SshProvisionInputV1, 
        provisionOutput: SshProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceRunner> {
        return new SshInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput,
        })
    }
}