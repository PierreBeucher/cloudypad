import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs, CommonConfigurationOutputV1Schema, CommonConfigurationInputV1Schema } from "../../core/state/state"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_DUMMY } from "../../core/const"
import { ServerRunningStatus } from "../../core/runner"

const DummyProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceId: z.string().describe("Dummy instance ID"),
    provisionedAt: z.number().describe("Timestamp (seconds) the instance was finished provisioned at"),
})

const DummyAuthSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("ssh-key"),
        ssh: z.object({
            user: z.string().describe("SSH user"),
            privateKeyPath: z.string().optional().describe("Local path to private key. Either privateKeyPath or privateKeyContentBase64 must be set, not both."),
            privateKeyContentBase64: z.string().optional().describe("Private key content (base64 encoded). Either privateKeyPath or privateKeyContentBase64 must be set, not both."),
        }).describe("SSH access configuration (key based)")
        .refine((data) => {
            if(data.privateKeyPath && data.privateKeyContentBase64 ||
                !data.privateKeyPath && !data.privateKeyContentBase64
            ){
                return false
            }
            return true
        }, {
            message: "Exactly one of privateKeyPath or privateKeyContentBase64 must be set"
        })
    }),
    z.object({
        type: z.literal("password"),
        ssh: z.object({
            user: z.string().describe("SSH user"),
            password: z.string().describe("SSH password"),
        }).describe("SSH access configuration (password based)")
    })
]);

const DummyProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    instanceType: z.string().describe("Type of Dummy instance"),
    startDelaySeconds: z.number().describe("Time (seconds) during which the instance will remain in 'starting' state before becoming 'running' on start/restart operation.").default(10),
    stopDelaySeconds: z.number().describe("Time (seconds) during which the instance will remain in 'stopping' state before becoming 'stopped' on stop/restart operation.").default(10),
    configurationDelaySeconds: z.number().describe("Time (seconds) during which configuration will run.").default(0).optional(),
    provisioningDelaySeconds: z.number().describe("Time (seconds) during which provisioning will run.").default(0).optional(),
    readinessAfterStartDelaySeconds: z.number().describe("Time (seconds) after starting the instance before it is considered ready to accept connections.").default(0).optional(),
    initialServerStateAfterProvision: z.enum(["running", "stopped"]).describe("Initial state of the instance server after provisioning.").default("running").optional(),
    customHost: z.string().describe("Custom host IP for dummy instance").optional(),
    auth: DummyAuthSchema.optional(),
})
.refine((data) => {
    if (data.auth?.type === "password") {
        return true;
    }
    
    if (!data.ssh) {
        return false;
    }
    
    return true;
}, {
    message: "SSH configuration is required unless password authentication is used"
});

const DummyConfigurationOutputV1Schema = CommonConfigurationOutputV1Schema.extend({
    dataDiskConfigured: z.boolean().describe("Whether the data disk was configured")
})

const DummyInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_DUMMY),
        output: DummyProvisionOutputV1Schema.optional(),
        input: DummyProvisionInputV1Schema,
    }),
    configuration: z.object({
        configurator: z.literal(CLOUDYPAD_CONFIGURATOR_ANSIBLE),
        input: CommonConfigurationInputV1Schema,
        output: DummyConfigurationOutputV1Schema.optional(),
    })
})

type DummyInstanceStateV1 = z.infer<typeof DummyInstanceStateV1Schema>
type DummyProvisionOutputV1 = z.infer<typeof DummyProvisionOutputV1Schema>
type DummyProvisionInputV1 = z.infer<typeof DummyProvisionInputV1Schema>
type DummyConfigurationOutputV1 = z.infer<typeof DummyConfigurationOutputV1Schema>
type DummyInstanceInput = InstanceInputs<DummyProvisionInputV1>
type DummyAuth = z.infer<typeof DummyAuthSchema>

export {
    DummyProvisionOutputV1Schema,
    DummyProvisionInputV1Schema,
    DummyConfigurationOutputV1Schema,
    DummyInstanceStateV1Schema,
    DummyInstanceStateV1,
    DummyProvisionOutputV1,
    DummyProvisionInputV1,
    DummyConfigurationOutputV1,
    DummyInstanceInput,
    DummyAuthSchema,
    DummyAuth
}

export class DummyStateParser extends GenericStateParser<DummyInstanceStateV1> {

    constructor() {
        super({ zodSchema: DummyInstanceStateV1Schema })
    }

    parse(rawState: unknown): DummyInstanceStateV1 {
        return this.zodParseSafe(rawState, DummyInstanceStateV1Schema)
    }
}

// V0

export interface DummyProvisionArgsV0 {
    create: {
        instanceType: string
        diskSize: number
        publicIpType: string
        region: string
        useSpot: boolean
    }
}

export interface DummyProviderStateV0 {
    instanceId?: string,
    provisionArgs?: DummyProvisionArgsV0
}