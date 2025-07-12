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
    ssh: z.object({
        hostname: z.string().describe("Host IP address"),
        user: z.string().describe("SSH user"),
        privateKeyPath: z.string().optional().describe("Local path to private key. Either privateKeyPath or privateKeyContentBase64 must be set, not both."),
        privateKeyContentBase64: z.string().optional().describe("Private key content (base64 encoded). Either privateKeyPath or privateKeyContentBase64 must be set, not both."),
        passwordBase64: z.string().optional().describe("Password (base64 encoded). Either passwordBase64 or password must be set, not both."),
    })
    .describe("SSH access configuration")
    .passthrough()
    .refine((data) => {
        // to check a single auth method is set, increment counter and check exactly one is set
        let setAuthMethods = 0
        if(data.privateKeyPath) setAuthMethods++
        if(data.privateKeyContentBase64) setAuthMethods++
        if(data.passwordBase64) setAuthMethods++
        return setAuthMethods === 1
    }, {
        message: "Exactly one of privateKeyPath, privateKeyContentBase64 or passwordBase64 must be set"
    })
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