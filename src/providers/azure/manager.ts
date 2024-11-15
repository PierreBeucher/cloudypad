import { AbstractInstanceManager } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { AzureProvisioner } from "./provisioner";
import { AzureInstanceRunner } from "./runner";
import { AzureProvisionConfigV1, AzureProvisionOutputV1 } from "./state";

export class AzureInstanceManager extends AbstractInstanceManager<AzureProvisionConfigV1, AzureProvisionOutputV1> {

    protected async doBuildInstanceRunnerWith(output: AzureProvisionOutputV1): Promise<InstanceRunner> {
        return new AzureInstanceRunner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: output
        })
    }

    protected async buildInstanceProvisioner(): Promise<InstanceProvisioner<AzureProvisionOutputV1>> {
        return new AzureProvisioner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: this.state.provision.output
        })
    }


}