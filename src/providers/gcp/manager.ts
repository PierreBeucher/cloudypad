import { AbstractInstanceManager } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { GcpProvisioner } from "./provisioner";
import { GcpInstanceRunner } from "./runner";
import { GcpProvisionConfigV1, GcpProvisionOutputV1 } from "./state";

export class GcpInstanceManager extends AbstractInstanceManager<GcpProvisionConfigV1, GcpProvisionOutputV1> {

    protected async doBuildInstanceRunnerWith(output: GcpProvisionOutputV1): Promise<InstanceRunner> {
        return new GcpInstanceRunner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: output
        })
    }

    protected async buildInstanceProvisioner(): Promise<InstanceProvisioner<GcpProvisionOutputV1>> {
        return new GcpProvisioner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: this.state.provision.output
        })
    }


}