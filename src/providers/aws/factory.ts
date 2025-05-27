import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { AwsProvisioner } from "./provisioner";
import { AwsInstanceRunner } from "./runner";
import { AwsInstanceStateV1, AwsProvisionInputV1, AwsProvisionOutputV1 } from "./state";
import { AbstractProvisionerFactory, AbstractRunnerFactory } from "../../core/submanager-factory";

export class AwsProvisionerFactory extends AbstractProvisionerFactory<AwsInstanceStateV1> {
    protected async doBuildProvisioner(
        name: string, 
        provisionInput: AwsProvisionInputV1, 
        provisionOutput: AwsProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceProvisioner> {
        return new AwsProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}

export class AwsRunnerFactory extends AbstractRunnerFactory<AwsInstanceStateV1> {
    protected async doBuildRunner(
        name: string, 
        provisionInput: AwsProvisionInputV1, 
        provisionOutput: AwsProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceRunner> {
        return new AwsInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}