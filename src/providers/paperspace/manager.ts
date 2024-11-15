import { AbstractInstanceManager } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { PaperspaceProvisioner } from "./provisioner";
import { PaperspaceInstanceRunner } from "./runner";
import { PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1 } from "./state";

export class PaperspaceInstanceManager extends AbstractInstanceManager<PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1> {

    protected async doBuildInstanceRunnerWith(output: PaperspaceProvisionOutputV1): Promise<InstanceRunner> {
        return new PaperspaceInstanceRunner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: output
        })
    }

    protected async buildInstanceProvisioner(): Promise<InstanceProvisioner<PaperspaceProvisionOutputV1>> {
        return new PaperspaceProvisioner({
            instanceName: this.state.name,
            config: this.state.provision.config,
            output: this.state.provision.output
        })
    }


}