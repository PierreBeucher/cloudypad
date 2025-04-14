import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs } from "../../core/state/state"
import { CLOUDYPAD_PROVIDER_SCALEWAY } from "../../core/const"
import { GenericStateParser } from "../../core/state/parser"

const ScalewayProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceName: z.string().describe("Scaleway instance name"),
    instanceServerId: z.string().describe("Scaleway instance server ID"),
})

const ScalewayProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    projectId: z.string().describe("Scaleway Project ID"),
    region: z.string().describe("Scaleway region"),
    zone: z.string().describe("Scaleway zone"),
    instanceType: z.string().describe("Scaleway instance type"),
    diskSizeGb: z.number().describe("Root (OS) disk size in GB."),
    imageId: z.string().optional().describe("Existing image ID for instance server. If set, disk size must be equal or greater than image size."),
    dataDiskSizeGb: z.number().default(0).describe("Data disk size in GB. If non-0, a disk dedicated for instance data (such as games data) will be created."),
})

const ScalewayInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_SCALEWAY),
        output: ScalewayProvisionOutputV1Schema.optional(),
        input: ScalewayProvisionInputV1Schema,
    }),
})

type ScalewayInstanceStateV1 = z.infer<typeof ScalewayInstanceStateV1Schema>
type ScalewayProvisionOutputV1 = z.infer<typeof ScalewayProvisionOutputV1Schema>
type ScalewayProvisionInputV1 = z.infer<typeof ScalewayProvisionInputV1Schema>

type ScalewayInstanceInput = InstanceInputs<ScalewayProvisionInputV1>

export {
    ScalewayProvisionOutputV1Schema,
    ScalewayProvisionInputV1Schema,
    ScalewayInstanceStateV1Schema,
    ScalewayInstanceStateV1,
    ScalewayProvisionOutputV1,
    ScalewayProvisionInputV1,
    ScalewayInstanceInput,
}

export class ScalewayStateParser extends GenericStateParser<ScalewayInstanceStateV1> {

    constructor() {
        super({ zodSchema: ScalewayInstanceStateV1Schema })
    }

    parse(rawState: unknown): ScalewayInstanceStateV1 {
        return this.zodParseSafe(rawState, ScalewayInstanceStateV1Schema)
    }
}
