import { z } from "zod"

export const PortDefinitionZ = z.object({
    from: z.number(),
    to: z.number().optional(),
    protocol: z.string().optional(),
    cidrBlocks: z.array(z.string()).optional(),
    ipv6CirdBlocks: z.array(z.string()).optional()
})

export type PortDefinition = z.infer<typeof PortDefinitionZ>

export const SSHDefinitionZ = z.object({
    privateKeyPath: z.string().optional(),
    port: z.optional(z.number()),
    user: z.optional(z.string()),
    authorizedKeys: z.optional(z.array(z.string())),
})

export type SSHDefinition = z.infer<typeof SSHDefinitionZ>

/**
 * Open standard oprt 22 for SSH
 */
export const STANDARD_SSH_PORTS : PortDefinition[] = [
    { from: 22, protocol: "tcp" }
]