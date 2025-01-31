import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { GcpProvisioner } from "./provisioner";
import { GcpInstanceRunner } from "./runner";
import { GcpInstanceStateV1, GcpProvisionInputV1, GcpProvisionOutputV1 } from "./state";

export class GcpSubManagerFactory extends AbstractSubManagerFactory<GcpInstanceStateV1> {

    async doBuildProvisioner(name: string, provisionInput: GcpProvisionInputV1, provisionOutput: GcpProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new GcpProvisioner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(name: string, provisionInput: GcpProvisionInputV1, provisionOutput: GcpProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceRunner> {
        return new GcpInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}