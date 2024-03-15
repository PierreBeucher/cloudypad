import { OutputMap } from "@pulumi/pulumi/automation"
import { PortDefinition } from "../../lib/infra/pulumi/components/security.js"
import { BoxManager, BoxManagerOutputs } from "../../lib/core.js"

export interface CloudVMBoxManagerOutputs extends BoxManagerOutputs {
    ipAddress: string
    id: string
}

export interface CloudVMBoxManager extends BoxManager {
    deploy() : Promise<CloudVMBoxManagerOutputs>

    provision() : Promise<CloudVMBoxManagerOutputs>

    get() : Promise<CloudVMBoxManagerOutputs>
}

export function outputsFromPulumi(o : OutputMap) : CloudVMBoxManagerOutputs{
    const result: CloudVMBoxManagerOutputs = {
        ipAddress: o["ipAddress"].value,
        id: o["id"].value
    }
    return result
}

/**
 * Open standard oprt 22 for SSH
 */
export const STANDARD_SSH_PORTS : PortDefinition[] = [
    { from: 22, protocol: "tcp" }
]