import { z } from "zod"
import { BoxManager, BoxManagerOutputs } from "./base.js"

// TODO use zod type ? 
export interface CloudVMBoxManagerOutputs extends BoxManagerOutputs {
    ipAddress: string
    instanceId: string
}

export abstract class CloudVMBoxManager extends BoxManager {
    abstract provision() : Promise<CloudVMBoxManagerOutputs>

    abstract configure() : Promise<CloudVMBoxManagerOutputs>

    abstract get() : Promise<CloudVMBoxManagerOutputs>
}

export const SUBSCHEMA_PORT_DEFINITION = z.object({
    from: z.number(),
    to: z.number().optional(),
    protocol: z.string().optional(),
    cidrBlocks: z.array(z.string()).optional(),
    ipv6CirdBlocks: z.array(z.string()).optional()
})

export type PortDefinition = z.infer<typeof SUBSCHEMA_PORT_DEFINITION>

export const SUBSCHEMA_SSH_DEFINITION = z.object({
    privateKeyPath: z.string(),
    port: z.optional(z.number()),
    user: z.optional(z.string())
})

export type SSHConfig = z.infer<typeof SUBSCHEMA_SSH_DEFINITION>

/**
 * Open standard oprt 22 for SSH
 */
export const STANDARD_SSH_PORTS : PortDefinition[] = [
    { from: 22, protocol: "tcp" }
]