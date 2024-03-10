import { OutputMap } from "@pulumi/pulumi/automation"
import { PortDefinition } from "../../lib/infra/pulumi/components/security.js"

export interface CloudVMBoxManagerOutputs {
    ipAddress: string
    id: string
}

export interface CloudVMBoxManager {
    deploy() : Promise<CloudVMBoxManagerOutputs>

    provision() : Promise<CloudVMBoxManagerOutputs>
    
    destroy() : Promise<void>

    preview() : Promise<string>

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