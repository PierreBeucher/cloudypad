import { z } from "zod"
import { BaseProvisionOutputV1Schema, BaseProvisionConfigV1Schema, InstanceStateV1Schema } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_AWS } from "../../core/const"

const AwsProvisionOutputV1Schema = BaseProvisionOutputV1Schema.extend({
    instanceId: z.string().describe("AWS instance ID"),
})

const AwsProvisionConfigV1Schema = BaseProvisionConfigV1Schema.extend({
    instanceType: z.string().describe("Type of AWS instance"),
    diskSize: z.number().describe("Disk size in GB"),
    publicIpType: z.string().describe("Type of public IP address (static or dynamic"),
    region: z.string().describe("AWS region"),
    useSpot: z.boolean().describe("Whether to use spot instances"),
})

const AwsInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_AWS),
        output: AwsProvisionOutputV1Schema.optional(),
        config: AwsProvisionConfigV1Schema,
    })
})

type AwsInstanceStateV1 = z.infer<typeof AwsInstanceStateV1Schema>
type AwsProvisionOutputV1 = z.infer<typeof AwsProvisionOutputV1Schema>
type AwsProvisionConfigV1 = z.infer<typeof AwsProvisionConfigV1Schema>

export {
    AwsProvisionOutputV1Schema,
    AwsProvisionConfigV1Schema,
    AwsInstanceStateV1Schema,
    AwsInstanceStateV1,
    AwsProvisionOutputV1,
    AwsProvisionConfigV1
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