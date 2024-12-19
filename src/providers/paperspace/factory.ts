import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { PaperspaceProvisioner } from "./provisioner";
import { PaperspaceInstanceRunner } from "./runner";
import { PaperspaceInstanceStateV1, PaperspaceProvisionConfigV1, PaperspaceProvisionOutputV1 } from "./state";

export class PaperspaceSubManagerFactory extends AbstractSubManagerFactory<PaperspaceInstanceStateV1> {

    async doBuildProvisioner(name: string, config: PaperspaceProvisionConfigV1, output: PaperspaceProvisionOutputV1): Promise<InstanceProvisioner> {
        return new PaperspaceProvisioner({
            instanceName: name,
            config: config,
            output: output,
        })
    }

    async doBuildRunner(name: string, config: PaperspaceProvisionConfigV1, output: PaperspaceProvisionOutputV1): Promise<InstanceRunner> {
        return new PaperspaceInstanceRunner({
            instanceName: name,
            config: config,
            output: output,
        })
    }
}