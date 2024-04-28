import { z } from "zod"
import { ReplicatedEC2InstanceManagerBoxSpecZ } from "../aws/replicated-ec2.js"
import { PaperspaceManagerBoxSpecZ } from "../paperspace/manager.js"

export const MachineProvisionerZ = z.object({
    aws: ReplicatedEC2InstanceManagerBoxSpecZ.deepPartial().optional(),
    paperspace: PaperspaceManagerBoxSpecZ.deepPartial().optional()
})

/**
 * All available machine provisioners
 */
export type MachineProvisioner = z.infer<typeof MachineProvisionerZ>

export function parseProvisionerName(p: MachineProvisioner): string {
    // TODO Unit test
    // Multiple providers can be used but exactly one must be set
    const provKeys = Object.keys(p)

    if (provKeys.length != 1) {
        throw new Error(`Exactly a single provisioner must be set. Got: ${provKeys}`)
    }

    return provKeys[0]
}