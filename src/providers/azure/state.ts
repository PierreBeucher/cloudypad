import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_AZURE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const"
import { GenericStateParser } from "../../core/state/parser"

export enum AZURE_SUPPORTED_DISK_TYPES {
    STANDARD_LRS = "Standard_LRS",
    STANDARD_SSD_LRS = "StandardSSD_LRS",
    PREMIUM_LRS = "Premium_LRS",
}

const AzureProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    vmName: z.string().optional().describe("Azure VM name"),
    resourceGroupName: z.string().describe("Azure Resource Group name"),
    rootDiskId: z.string().optional().describe("Azure OS managed disk ID"),
})

const AzureProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    vmSize: z.string().describe("Azure VM size"),
    diskSize: z.number().describe("Root (OS) disk size in GB"),
    diskType: z.string().describe("Disk type (HDD, SSD...)").default(AZURE_SUPPORTED_DISK_TYPES.STANDARD_LRS),
    dataDiskSizeGb: z.number().optional().describe("Data disk size in GB. If non-0, a disk dedicated for instance data (such as games data) will be created."),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).describe("Type of public IP address. Deprecated: static IP is now the only default. Dynamic IP will be removed in future release."),
    subscriptionId: z.string().describe("Azure Subscription ID"),
    location: z.string().describe("Azure location/region"),
    useSpot: z.boolean().describe("Whether to use spot instances"),
    costAlert: z.object({
        limit: z.number().describe("Cost alert limit"),
        notificationEmail: z.string().describe("Cost alert notification email"),
    }).nullish(),
})

const AzureInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.string(),
        output: AzureProvisionOutputV1Schema.optional(),
        input: AzureProvisionInputV1Schema,
    }),
})

type AzureInstanceStateV1 = z.infer<typeof AzureInstanceStateV1Schema>
type AzureProvisionOutputV1 = z.infer<typeof AzureProvisionOutputV1Schema>
type AzureProvisionInputV1 = z.infer<typeof AzureProvisionInputV1Schema>

type AzureInstanceInput = InstanceInputs<AzureProvisionInputV1>

export {
    AzureProvisionOutputV1Schema,
    AzureProvisionInputV1Schema,
    AzureInstanceStateV1Schema,
    AzureInstanceStateV1,
    AzureProvisionOutputV1,
    AzureProvisionInputV1,
    AzureInstanceInput,
}

export class AzureStateParser extends GenericStateParser<AzureInstanceStateV1> {

    constructor() {
        super({ zodSchema: AzureInstanceStateV1Schema })
    }

    parse(rawState: unknown): AzureInstanceStateV1 {
        return this.zodParseSafe(rawState, AzureInstanceStateV1Schema)
    }
}
// V0

export interface AzureProviderStateV0 {
    vmName?: string
    resourceGroupName?: string
    provisionArgs?: AzureProvisionArgsV0
}

export interface AzureProvisionArgsV0 {
    create: {
        vmSize: string
        diskSize: number
        publicIpType: string
        subscriptionId: string
        location: string
        useSpot: boolean
    }
}

