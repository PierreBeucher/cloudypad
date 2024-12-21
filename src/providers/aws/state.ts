import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_AWS, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const"

const AwsProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceId: z.string().describe("AWS instance ID"),
})

const AwsProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    instanceType: z.string().describe("Type of AWS instance"),
    diskSize: z.number().describe("Disk size in GB"),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).describe("Type of public IP address"),
    region: z.string().describe("AWS region"),
    useSpot: z.boolean().describe("Whether to use spot instances"),
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

export {
    AwsProvisionOutputV1Schema,
    AwsProvisionInputV1Schema,
    AwsInstanceStateV1Schema,
    AwsInstanceStateV1,
    AwsProvisionOutputV1,
    AwsProvisionInputV1,
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