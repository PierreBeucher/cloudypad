import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionConfigV1Schema, InstanceStateV1Schema } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const"

const PaperspaceProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    machineId: z.string().describe("Paperspace machine ID"),
})

const PaperspaceProvisionConfigV1Schema = CommonProvisionConfigV1Schema.extend({
    apiKey: z.string().describe("Paperspace API key"),
    machineType: z.string().describe("Type of Paperspace machine"),
    diskSize: z.number().describe("Disk size in GB"),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).describe("Type of public IP address"),
    region: z.string().describe("Paperspace region"),
})

const PaperspaceInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_PAPERSPACE),
        output: PaperspaceProvisionOutputV1Schema.optional(),
        config: PaperspaceProvisionConfigV1Schema,
    })
})

type PaperspaceInstanceStateV1 = z.infer<typeof PaperspaceInstanceStateV1Schema>
type PaperspaceProvisionOutputV1 = z.infer<typeof PaperspaceProvisionOutputV1Schema>
type PaperspaceProvisionConfigV1 = z.infer<typeof PaperspaceProvisionConfigV1Schema>

export {
    PaperspaceProvisionOutputV1Schema,
    PaperspaceProvisionConfigV1Schema,
    PaperspaceInstanceStateV1Schema,
    PaperspaceInstanceStateV1,
    PaperspaceProvisionOutputV1,
    PaperspaceProvisionConfigV1
}

// V0

export interface PaperspaceProviderStateV0 {
    machineId?: string,
    apiKey: string
    provisionArgs?: PaperspaceProvisionArgsV0
}

export interface PaperspaceProvisionArgsV0 {
    useExisting?: {
        machineId: string
        publicIp: string
    }
    apiKey?: string
    create?: {
        machineType: string
        diskSize: number
        publicIpType: PUBLIC_IP_TYPE
        region: string
    }
}
