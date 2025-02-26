import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { CommonConfigurationInputV1 } from "../../core/state/state";
import { DummyProvisioner } from "./provisioner";
import { DummyInstanceRunner } from "./runner";
import { DummyInstanceStateV1, DummyProvisionInputV1, DummyProvisionOutputV1 } from "./state";
import { DummyConfigurator } from "./configurator";
import { InstanceConfigurator } from "../../core/configurator";

export class DummySubManagerFactory extends AbstractSubManagerFactory<DummyInstanceStateV1> {

    async doBuildProvisioner(name: string, provisionInput: DummyProvisionInputV1, provisionOutput: DummyProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceProvisioner> {
        return new DummyProvisioner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildRunner(name: string, provisionInput: DummyProvisionInputV1, provisionOutput: DummyProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceRunner> {
        return new DummyInstanceRunner({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput
        })
    }

    async doBuildConfigurator(name: string, provisionInput: DummyProvisionInputV1, provisionOutput: DummyProvisionOutputV1, configurationInput: CommonConfigurationInputV1): Promise<InstanceConfigurator> {
        return new DummyConfigurator({ instanceName: name })
    }
}