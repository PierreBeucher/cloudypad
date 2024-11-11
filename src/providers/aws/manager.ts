import { AbstractInstanceManager } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { AwsProvisioner } from "./provisioner";
import { AwsInstanceRunner } from "./runner";
import { AwsProvisionConfigV1, AwsProvisionOutputV1 } from "./state";

export class AwsInstanceManager extends AbstractInstanceManager<AwsProvisionConfigV1, AwsProvisionOutputV1> {

    protected async doBuildInstanceRunnerWith(output: AwsProvisionOutputV1): Promise<InstanceRunner> {
        return new AwsInstanceRunner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: output
        })
    }

    protected async buildInstanceProvisioner(): Promise<InstanceProvisioner<AwsProvisionOutputV1>> {
        return new AwsProvisioner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: this.state.provision.output
        })
    }


}