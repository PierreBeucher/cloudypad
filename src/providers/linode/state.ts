import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_LINODE } from "../../core/const"
import { GenericStateParser } from "../../core/state/parser"

const LinodeProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceServerName: z.string().describe("Linode instance server name").optional(),
    instanceServerId: z.string().describe("Linode instance server ID").optional(),
    dataDiskId: z.string().describe("Linode data disk ID"),
})

const LinodeProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    region: z.string().describe("Linode region"),
    instanceType: z.string().describe("Linode instance type"),
    apiToken: z.string().optional().describe("Linode API token. If not set, LINODE_TOKEN environment variable will be used."),
    imageId: z.string().optional().describe("Existing image ID for instance server. If set, disk size must be equal or greater than image size"),
    rootDiskSizeGb: z.number().describe("Root (OS) disk size in GB"),
    dataDiskSizeGb: z.number().default(0).describe("Data disk size in GB. If non-0, a disk dedicated for instance data (such as games data) will be created"),
})

const LinodeInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_LINODE),
        output: LinodeProvisionOutputV1Schema.optional(),
        input: LinodeProvisionInputV1Schema,
    }),
})

type LinodeInstanceStateV1 = z.infer<typeof LinodeInstanceStateV1Schema>
type LinodeProvisionOutputV1 = z.infer<typeof LinodeProvisionOutputV1Schema>
type LinodeProvisionInputV1 = z.infer<typeof LinodeProvisionInputV1Schema>

type LinodeInstanceInput = InstanceInputs<LinodeProvisionInputV1>

export {
    LinodeProvisionOutputV1Schema,
    LinodeProvisionInputV1Schema,
    LinodeInstanceStateV1Schema,
    LinodeInstanceStateV1,
    LinodeProvisionOutputV1,
    LinodeProvisionInputV1,
    LinodeInstanceInput,
}

export class LinodeStateParser extends GenericStateParser<LinodeInstanceStateV1> {

    constructor() {
        super({ zodSchema: LinodeInstanceStateV1Schema })
    }

    parse(rawState: unknown): LinodeInstanceStateV1 {
        return this.zodParseSafe(rawState, LinodeInstanceStateV1Schema)
    }
} 