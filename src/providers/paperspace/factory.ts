import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { PaperspaceProvisioner } from "./provisioner";
import { PaperspaceInstanceRunner } from "./runner";
import { PaperspaceInstanceStateV1, PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1 } from "./state";

export class PaperspaceSubManagerFactory extends AbstractSubManagerFactory<PaperspaceInstanceStateV1> {

    async doBuildProvisioner(name: string, input: PaperspaceProvisionInputV1, output: PaperspaceProvisionOutputV1): Promise<InstanceProvisioner> {
        return new PaperspaceProvisioner({
            instanceName: name,
            input: input,
            output: output,
        })
    }

    async doBuildRunner(name: string, input: PaperspaceProvisionInputV1, output: PaperspaceProvisionOutputV1): Promise<InstanceRunner> {
        return new PaperspaceInstanceRunner({
            instanceName: name,
            input: input,
            output: output,
        })
    }
}