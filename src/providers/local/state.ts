import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs, CommonConfigurationOutputV1Schema, CommonConfigurationInputV1Schema } from "../../core/state/state"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_LOCAL } from "../../core/const"
import { ServerRunningStatus } from "../../core/runner"

const LocalProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    provisionedAt: z.number().describe("Timestamp (seconds) the instance was finished provisioned at"),
})

// Override SSH config to provide hostname and password directly as input
const LocalProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    hostname: z.string().describe("Server IP address or hostname"),
}).passthrough()

const LocalInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_LOCAL),
        output: LocalProvisionOutputV1Schema.optional(),
        input: LocalProvisionInputV1Schema,
    }),
})

type LocalInstanceStateV1 = z.infer<typeof LocalInstanceStateV1Schema>
type LocalProvisionOutputV1 = z.infer<typeof LocalProvisionOutputV1Schema>
type LocalProvisionInputV1 = z.infer<typeof LocalProvisionInputV1Schema>
type LocalInstanceInput = InstanceInputs<LocalProvisionInputV1>

export {
    LocalProvisionOutputV1Schema,
    LocalProvisionInputV1Schema,
    LocalInstanceStateV1Schema,
    LocalInstanceStateV1,
    LocalProvisionOutputV1,
    LocalProvisionInputV1,
    LocalInstanceInput,
}

export class LocalStateParser extends GenericStateParser<LocalInstanceStateV1> {

    constructor() {
        super({ zodSchema: LocalInstanceStateV1Schema })
    }

    parse(rawState: unknown): LocalInstanceStateV1 {
        return this.zodParseSafe(rawState, LocalInstanceStateV1Schema)
    }
}