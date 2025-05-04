import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { AzureProvisioner } from "./provisioner";
import { AzureInstanceRunner } from "./runner";
import { AzureInstanceStateV1, AzureProvisionInputV1, AzureProvisionOutputV1 } from "./state";

export class AzureSubManagerFactory extends AbstractSubManagerFactory<AzureInstanceStateV1> {

    async doBuildProvisioner(name: string, provisionInput: AzureProvisionInputV1, provisionOutput: AzureProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new AzureProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(name: string, provisionInput: AzureProvisionInputV1, provisionOutput: AzureProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceRunner> {
        return new AzureInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}