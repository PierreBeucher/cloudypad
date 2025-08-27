import { AbstractProvisionerFactory, AbstractRunnerFactory } from "../../core/submanager-factory";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { LinodeProvisioner } from "./provisioner";
import { LinodeInstanceRunner } from "./runner";
import { LinodeInstanceStateV1, LinodeProvisionInputV1, LinodeProvisionOutputV1 } from "./state";

export class LinodeProvisionerFactory extends AbstractProvisionerFactory<LinodeInstanceStateV1> {
    protected async doBuildProvisioner(
        name: string, 
        provisionInput: LinodeProvisionInputV1, 
        provisionOutput: LinodeProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceProvisioner> {
        return new LinodeProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}

export class LinodeRunnerFactory extends AbstractRunnerFactory<LinodeInstanceStateV1> {
    protected async doBuildRunner(
        name: string, 
        provisionInput: LinodeProvisionInputV1, 
        provisionOutput: LinodeProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceRunner> {
        return new LinodeInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
} 