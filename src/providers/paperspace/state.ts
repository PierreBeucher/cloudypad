import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const"
import { GenericStateParser } from "../../core/state/parser"

const PaperspaceProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    machineId: z.string().describe("Paperspace machine ID"),
})

const PaperspaceProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    apiKey: z.string().describe("Paperspace API key"),
    machineType: z.string().describe("Type of Paperspace machine"),
    diskSize: z.number().describe("Disk size in GB"),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).describe("Type of public IP address. Deprecated: static IP is now the only default. Dynamic IP will be removed in future release."),
    region: z.string().describe("Paperspace region"),
})

const PaperspaceInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_PAPERSPACE),
        output: PaperspaceProvisionOutputV1Schema.optional(),
        input: PaperspaceProvisionInputV1Schema,
    })
})

type PaperspaceInstanceStateV1 = z.infer<typeof PaperspaceInstanceStateV1Schema>
type PaperspaceProvisionOutputV1 = z.infer<typeof PaperspaceProvisionOutputV1Schema>
type PaperspaceProvisionInputV1 = z.infer<typeof PaperspaceProvisionInputV1Schema>

type PaperspaceInstanceInput = InstanceInputs<PaperspaceProvisionInputV1>

export {
    PaperspaceProvisionOutputV1Schema,
    PaperspaceProvisionInputV1Schema,
    PaperspaceInstanceStateV1Schema,
    PaperspaceInstanceStateV1,
    PaperspaceProvisionOutputV1,
    PaperspaceProvisionInputV1,
    PaperspaceInstanceInput,
}

export class PaperspaceStateParser extends GenericStateParser<PaperspaceInstanceStateV1> {

    constructor() {
        super({ zodSchema: PaperspaceInstanceStateV1Schema })
    }

    parse(rawState: unknown): PaperspaceInstanceStateV1 {
        return this.zodParseSafe(rawState, PaperspaceInstanceStateV1Schema)
    }
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
