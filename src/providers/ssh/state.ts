import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema as SshStateV1Schema, InstanceInputs, CommonConfigurationOutputV1Schema, CommonConfigurationInputV1Schema } from "../../core/state/state"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_SSH } from "../../core/const"
import { ServerRunningStatus } from "../../core/runner"

const SshProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    provisionedAt: z.number().describe("Timestamp (seconds) the instance was finished provisioned at"),
})

// Override SSH config to provide hostname and password directly as input
const SshProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    hostname: z.string().describe("Server IP address or hostname"),
}).passthrough()

const SshInstanceStateV1Schema = SshStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_SSH),
        output: SshProvisionOutputV1Schema.optional(),
        input: SshProvisionInputV1Schema,
    }),
})

type SshInstanceStateV1 = z.infer<typeof SshInstanceStateV1Schema>
type SshProvisionOutputV1 = z.infer<typeof SshProvisionOutputV1Schema>
type SshProvisionInputV1 = z.infer<typeof SshProvisionInputV1Schema>
type SshInstanceInput = InstanceInputs<SshProvisionInputV1>

export {
    SshProvisionOutputV1Schema,
    SshProvisionInputV1Schema,
    SshInstanceStateV1Schema,
    SshInstanceStateV1,
    SshProvisionOutputV1,
    SshProvisionInputV1,
    SshInstanceInput,
}

export class SshStateParser extends GenericStateParser<SshInstanceStateV1> {

    constructor() {
        super({ zodSchema: SshInstanceStateV1Schema })
    }

    parse(rawState: unknown): SshInstanceStateV1 {
        return this.zodParseSafe(rawState, SshInstanceStateV1Schema)
    }
}