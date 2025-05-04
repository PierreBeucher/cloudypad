import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { AwsProvisioner } from "./provisioner";
import { AwsInstanceRunner } from "./runner";
import { AwsInstanceStateV1, AwsProvisionInputV1, AwsProvisionOutputV1 } from "./state";

export class AwsSubManagerFactory extends AbstractSubManagerFactory<AwsInstanceStateV1> {

    async doBuildProvisioner(name: string, provisionInput: AwsProvisionInputV1, provisionOutput: AwsProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new AwsProvisioner({
            coreConfig: this.coreConfig,   
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(name: string, provisionInput: AwsProvisionInputV1, provisionOutput: AwsProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceRunner> {
        return new AwsInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}