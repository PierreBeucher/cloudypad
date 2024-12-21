import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { AzureProvisioner } from "./provisioner";
import { AzureInstanceRunner } from "./runner";
import { AzureInstanceStateV1, AzureProvisionInputV1, AzureProvisionOutputV1 } from "./state";

export class AzureSubManagerFactory extends AbstractSubManagerFactory<AzureInstanceStateV1> {

    async doBuildProvisioner(name: string, input: AzureProvisionInputV1, output: AzureProvisionOutputV1): Promise<InstanceProvisioner> {
        return new AzureProvisioner({
            instanceName: name,
            input: input,
            output: output,
        })
    }

    async doBuildRunner(name: string, input: AzureProvisionInputV1, output: AzureProvisionOutputV1): Promise<InstanceRunner> {
        return new AzureInstanceRunner({
            instanceName: name,
            input: input,
            output: output,
        })
    }
}