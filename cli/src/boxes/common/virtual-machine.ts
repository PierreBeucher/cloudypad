import { z } from "zod"
import { BoxOutputs, BoxProvisioner } from "./base.js"

export interface VMProvisionerBoxOutputs extends BoxOutputs {
    ipAddress: string
    instanceId: string
}

export interface MultiVMProvisionerBoxOutputs extends BoxOutputs {
    replicas: VMProvisionerBoxOutputs[]
}

export interface VMConfiguratorOutputs extends BoxOutputs {
    hostname: string
}

export interface VMBoxProvisioner extends BoxProvisioner {
    get() : Promise<VMProvisionerBoxOutputs>
    provision() : Promise<VMProvisionerBoxOutputs>
}

export interface MultiVMBoxProvisioner extends BoxProvisioner {
    
}

export const PortDefinitionZ = z.object({
    from: z.number(),
    to: z.number().optional(),
    protocol: z.string().optional(),
    cidrBlocks: z.array(z.string()).optional(),
    ipv6CirdBlocks: z.array(z.string()).optional()
})

export type PortDefinition = z.infer<typeof PortDefinitionZ>

export const SSHDefinitionZ = z.object({
    privateKeyPath: z.string(),
    port: z.optional(z.number()),
    user: z.optional(z.string())
})

export type SSHConfig = z.infer<typeof SSHDefinitionZ>

/**
 * Open standard oprt 22 for SSH
 */
export const STANDARD_SSH_PORTS : PortDefinition[] = [
    { from: 22, protocol: "tcp" }
]