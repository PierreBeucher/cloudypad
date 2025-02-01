import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { PaperspaceProvisioner } from "./provisioner";
import { PaperspaceInstanceRunner } from "./runner";
import { PaperspaceInstanceStateV1, PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1 } from "./state";

export class PaperspaceSubManagerFactory extends AbstractSubManagerFactory<PaperspaceInstanceStateV1> {

    async doBuildProvisioner(name: string, provisionInput: PaperspaceProvisionInputV1, provisionOutput: PaperspaceProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new PaperspaceProvisioner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(name: string, provisionInput: PaperspaceProvisionInputV1, provisionOutput: PaperspaceProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceRunner> {
        return new PaperspaceInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}