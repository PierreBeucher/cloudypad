import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { GcpProvisioner } from "./provisioner";
import { GcpInstanceRunner } from "./runner";
import { GcpInstanceStateV1, GcpProvisionInputV1, GcpProvisionOutputV1 } from "./state";
import { AbstractProvisionerFactory, AbstractRunnerFactory } from "../../core/submanager-factory";

export class GcpProvisionerFactory extends AbstractProvisionerFactory<GcpInstanceStateV1> {
    protected async doBuildProvisioner(
        name: string, 
        provisionInput: GcpProvisionInputV1, 
        provisionOutput: GcpProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceProvisioner> {
        return new GcpProvisioner({
            coreConfig: this.coreConfig,
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}

export class GcpRunnerFactory extends AbstractRunnerFactory<GcpInstanceStateV1> {
    protected async doBuildRunner(
        name: string, 
        provisionInput: GcpProvisionInputV1, 
        provisionOutput: GcpProvisionOutputV1, 
        configurationInput: CommonConfigurationInputV1
    ): Promise<InstanceRunner> {
        return new GcpInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        });
    }
}