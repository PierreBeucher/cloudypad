import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { AwsProvisioner } from "./provisioner";
import { AwsInstanceRunner } from "./runner";
import { AwsInstanceStateV1, AwsProvisionConfigV1, AwsProvisionOutputV1 } from "./state";

export class AwsSubManagerFactory extends AbstractSubManagerFactory<AwsInstanceStateV1> {

    async doBuildProvisioner(name: string, config: AwsProvisionConfigV1, output: AwsProvisionOutputV1): Promise<InstanceProvisioner> {
        return new AwsProvisioner({
            instanceName: name,
            config: config,
            output: output,
        })
    }

    async doBuildRunner(name: string, config: AwsProvisionConfigV1, output: AwsProvisionOutputV1): Promise<InstanceRunner> {
        return new AwsInstanceRunner({
            instanceName: name,
            config: config,
            output: output,
        })
    }
}