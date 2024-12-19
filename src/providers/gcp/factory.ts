import { AbstractSubManagerFactory } from "../../core/manager";
import { InstanceProvisioner } from "../../core/provisioner";
import { InstanceRunner } from "../../core/runner";
import { GcpProvisioner } from "./provisioner";
import { GcpInstanceRunner } from "./runner";
import { GcpInstanceStateV1, GcpProvisionConfigV1, GcpProvisionOutputV1 } from "./state";

export class GcpSubManagerFactory extends AbstractSubManagerFactory<GcpInstanceStateV1> {

    async doBuildProvisioner(name: string, config: GcpProvisionConfigV1, output: GcpProvisionOutputV1): Promise<InstanceProvisioner> {
        return new GcpProvisioner({
            instanceName: name,
            config: config,
            output: output,
        })
    }

    async doBuildRunner(name: string, config: GcpProvisionConfigV1, output: GcpProvisionOutputV1): Promise<InstanceRunner> {
        return new GcpInstanceRunner({
            instanceName: name,
            config: config,
            output: output,
        })
    }
}