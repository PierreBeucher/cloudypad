import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { AzureProvisioner } from "./provisioner";
import { AzureInstanceRunner } from "./runner";
import { AzureInstanceStateV1, AzureProvisionConfigV1, AzureProvisionOutputV1 } from "./state";

export class AzureSubManagerFactory extends AbstractSubManagerFactory<AzureInstanceStateV1> {

    async doBuildProvisioner(name: string, config: AzureProvisionConfigV1, output: AzureProvisionOutputV1): Promise<InstanceProvisioner> {
        return new AzureProvisioner({
            instanceName: name,
            config: config,
            output: output,
        })
    }

    async doBuildRunner(name: string, config: AzureProvisionConfigV1, output: AzureProvisionOutputV1): Promise<InstanceRunner> {
        return new AzureInstanceRunner({
            instanceName: name,
            config: config,
            output: output,
        })
    }
}