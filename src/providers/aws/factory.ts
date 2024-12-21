import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { AwsProvisioner } from "./provisioner";
import { AwsInstanceRunner } from "./runner";
import { AwsInstanceStateV1, AwsProvisionInputV1, AwsProvisionOutputV1 } from "./state";

export class AwsSubManagerFactory extends AbstractSubManagerFactory<AwsInstanceStateV1> {

    async doBuildProvisioner(name: string, input: AwsProvisionInputV1, output: AwsProvisionOutputV1): Promise<InstanceProvisioner> {
        return new AwsProvisioner({
            instanceName: name,
            input: input,
            output: output,
        })
    }

    async doBuildRunner(name: string, input: AwsProvisionInputV1, output: AwsProvisionOutputV1): Promise<InstanceRunner> {
        return new AwsInstanceRunner({
            instanceName: name,
            input: input,
            output: output,
        })
    }
}