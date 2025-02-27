import { z } from "zod"
import { CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, InstanceStateV1Schema, InstanceInputs } from "../../core/state/state"
import { GenericStateParser } from "../../core/state/parser"
import { CLOUDYPAD_PROVIDER_DUMMY } from "../../core/const"

const DummyProvisionOutputV1Schema = CommonProvisionOutputV1Schema.extend({
    instanceId: z.string().describe("Dummy instance ID"),
})

const DummyProvisionInputV1Schema = CommonProvisionInputV1Schema.extend({
    instanceType: z.string().describe("Type of Dummy instance"),
})

const DummyInstanceStateV1Schema = InstanceStateV1Schema.extend({
    provision: z.object({
        provider: z.literal(CLOUDYPAD_PROVIDER_DUMMY),
        output: DummyProvisionOutputV1Schema.optional(),
        input: DummyProvisionInputV1Schema,
    })
})

type DummyInstanceStateV1 = z.infer<typeof DummyInstanceStateV1Schema>
type DummyProvisionOutputV1 = z.infer<typeof DummyProvisionOutputV1Schema>
type DummyProvisionInputV1 = z.infer<typeof DummyProvisionInputV1Schema>

type DummyInstanceInput = InstanceInputs<DummyProvisionInputV1>

export {
    DummyProvisionOutputV1Schema,
    DummyProvisionInputV1Schema,
    DummyInstanceStateV1Schema,
    DummyInstanceStateV1,
    DummyProvisionOutputV1,
    DummyProvisionInputV1,
    DummyInstanceInput,
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