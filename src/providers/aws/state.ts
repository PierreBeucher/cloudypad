import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_AWS, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const"
import { GenericStateParser } from "../../core/state/parser"

const AwsProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceId: z.string().optional().describe("AWS instance ID"),
    rootDiskId: z.string().optional().describe("AWS root EBS volume ID"),
    dataDiskId: z.string().optional().describe("AWS data EBS volume ID"),
})

const AwsProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    instanceType: z.string().describe("Type of AWS instance"),
    diskSize: z.number().describe("Root disk size in GB"),
    dataDiskSizeGb: z.number().optional().describe("Data disk size in GB. If non-0, a disk dedicated for instance data (such as games data) will be created."),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).describe("Type of public IP address"),
    region: z.string().describe("AWS region"),
    zone: z.string().optional().describe("AWS availability zone"),
    useSpot: z.boolean().describe("Whether to use spot instances"),
    costAlert: z.object({
        limit: z.number().describe("Cost alert limit (USD)"),
        notificationEmail: z.string().describe("Cost alert notification email"),
    }).nullish().describe("Cost alert settings. If not provided, cost alert will not be enabled."),
})

const AwsInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_AWS),
        output: AwsProvisionOutputV1Schema.optional(),
        input: AwsProvisionInputV1Schema,
    })
})

type AwsInstanceStateV1 = z.infer<typeof AwsInstanceStateV1Schema>
type AwsProvisionOutputV1 = z.infer<typeof AwsProvisionOutputV1Schema>
type AwsProvisionInputV1 = z.infer<typeof AwsProvisionInputV1Schema>

type AwsInstanceInput = InstanceInputs<AwsProvisionInputV1>

export {
    AwsProvisionOutputV1Schema,
    AwsProvisionInputV1Schema,
    AwsInstanceStateV1Schema,
    AwsInstanceStateV1,
    AwsProvisionOutputV1,
    AwsProvisionInputV1,
    AwsInstanceInput,
}

export class AwsStateParser extends GenericStateParser<AwsInstanceStateV1> {

    constructor() {
        super({ zodSchema: AwsInstanceStateV1Schema })
    }

    parse(rawState: unknown): AwsInstanceStateV1 {
        return this.zodParseSafe(rawState, AwsInstanceStateV1Schema)
    }
}

// V0

export interface AwsProvisionArgsV0 {
    create: {
        instanceType: string
        diskSize: number
        publicIpType: string
        region: string
        useSpot: boolean
    }
}

export interface AwsProviderStateV0 {
    instanceId?: string,
    provisionArgs?: AwsProvisionArgsV0
}