import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { ScalewayProvisioner } from "./provisioner";
import { ScalewayInstanceRunner } from "./runner";
import { ScalewayInstanceStateV1, ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from "./state";

export class ScalewaySubManagerFactory extends AbstractSubManagerFactory<ScalewayInstanceStateV1> {

    async doBuildProvisioner(name: string, provisionInput: ScalewayProvisionInputV1, provisionOutput: ScalewayProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new ScalewayProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(name: string, provisionInput: ScalewayProvisionInputV1, provisionOutput: ScalewayProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceRunner> {
        return new ScalewayInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }
}