import { AbstractProvisionerFactory, AbstractRunnerFactory } from "../../core/submanager-factory";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { PaperspaceProvisioner } from "./provisioner";
import { PaperspaceInstanceRunner } from "./runner";
import { PaperspaceInstanceStateV1, PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1 } from "./state";

export class PaperspaceProvisionerFactory extends AbstractProvisionerFactory<PaperspaceInstanceStateV1> {
    protected async doBuildProvisioner(
        name: string, 
        provisionInput: PaperspaceProvisionInputV1, 
        provisionOutput: PaperspaceProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceProvisioner> {
        return new PaperspaceProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}

export class PaperspaceRunnerFactory extends AbstractRunnerFactory<PaperspaceInstanceStateV1> {
    protected async doBuildRunner(
        name: string, 
        provisionInput: PaperspaceProvisionInputV1, 
        provisionOutput: PaperspaceProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceRunner> {
        return new PaperspaceInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}