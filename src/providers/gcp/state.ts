import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs, CostAlertSchema } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const"
import { GenericStateParser } from "../../core/state/parser"

const GcpProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceName: z.string().describe("GCP instance name"),
})

const GcpProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    projectId: z.string().describe("GCP Project ID"),
    machineType: z.string().describe("GCP Machine Type"),
    acceleratorType: z.string().describe("GCP Accelerator Type"),
    diskSize: z.number().describe("Disk size in GB"),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).describe("Type of public IP address"),
    region: z.string().describe("GCP region"),
    zone: z.string().describe("GCP zone"),
    useSpot: z.boolean().describe("Whether to use spot instances"),
    costAlert: CostAlertSchema,
})

const GcpInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_GCP),
        output: GcpProvisionOutputV1Schema.optional(),
        input: GcpProvisionInputV1Schema,
    }),
})

type GcpInstanceStateV1 = z.infer<typeof GcpInstanceStateV1Schema>
type GcpProvisionOutputV1 = z.infer<typeof GcpProvisionOutputV1Schema>
type GcpProvisionInputV1 = z.infer<typeof GcpProvisionInputV1Schema>

type GcpInstanceInput = InstanceInputs<GcpProvisionInputV1>

export {
    GcpProvisionOutputV1Schema,
    GcpProvisionInputV1Schema as GcpProvisionInputV1Schema,
    GcpInstanceStateV1Schema,
    GcpInstanceStateV1,
    GcpProvisionOutputV1,
    GcpProvisionInputV1,
    GcpInstanceInput,  
}

export class GcpStateParser extends GenericStateParser<GcpInstanceStateV1> {

    constructor() {
        super({ zodSchema: GcpInstanceStateV1Schema })
    }

    parse(rawState: unknown): GcpInstanceStateV1 {
        return this.zodParseSafe(rawState, GcpInstanceStateV1Schema)
    }
}

// V0

export interface GcpProviderStateV0 {
    instanceName?: string,
    provisionArgs?: GcpProvisionArgsV0
}

export interface GcpProvisionArgsV0 {
    create: {
        projectId: string
        machineType: string
        acceleratorType: string
        diskSize: number
        publicIpType: string
        region: string
        zone: string
        useSpot: boolean
    }
}