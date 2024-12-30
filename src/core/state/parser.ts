import { z } from "zod";
import { getLogger } from "../../log/utils";
import { AwsInstanceStateV1, AwsInstanceStateV1Schema } from "../../providers/aws/state";
import { AzureInstanceStateV1, AzureInstanceStateV1Schema } from "../../providers/azure/state";
import { GcpInstanceStateV1, GcpInstanceStateV1Schema } from "../../providers/gcp/state";
import { PaperspaceInstanceStateV1, PaperspaceInstanceStateV1Schema } from "../../providers/paperspace/state";
import { InstanceStateV1, InstanceStateV1Schema } from "./state";

// const AnyInstanceStateV1Schema = 
//     AwsInstanceStateV1Schema
//     .or(AzureInstanceStateV1Schema)
//     .or(GcpInstanceStateV1Schema)
//     .or(PaperspaceInstanceStateV1Schema)

export type AnyInstanceStateV1 = AwsInstanceStateV1 | 
    AzureInstanceStateV1 | 
    GcpInstanceStateV1 | 
    PaperspaceInstanceStateV1

/**
 * State Parser to safely load and verify states using Zod
 */
export class StateParser {

    private logger = getLogger(StateParser.name)

    /**
     * Parse a raw State into known State schema. The State is validated only for base InstanceStateV1Schema
     * but unknown keys are kept, allowing any provider-specific state to be passed and it will retain all elements
     * not present on InstanceStateV1Schema. 
     * Not suitable for use with provider-specific component. A second parsing round is required with parsePROVIDERStateV1 functions.
     */
    parseBaseStateV1(rawState: unknown): InstanceStateV1 {
        const result = this.zodParseSafe(rawState, InstanceStateV1Schema)
        return result
    }

    parseAwsStateV1(rawState: unknown): AwsInstanceStateV1 {
        const result = this.zodParseSafe(rawState, AwsInstanceStateV1Schema)
        return result
    }

    parseAzureStateV1(rawState: unknown): AzureInstanceStateV1 {
        const result = this.zodParseSafe(rawState, AzureInstanceStateV1Schema)
        return result
    }

    parseGcpStateV1(rawState: unknown): GcpInstanceStateV1 {
        const result = this.zodParseSafe(rawState, GcpInstanceStateV1Schema)
        return result
    }

    parsePaperspaceStateV1(rawState: unknown): PaperspaceInstanceStateV1 {
        const result = this.zodParseSafe(rawState, PaperspaceInstanceStateV1Schema)
        return result
    }

    private zodParseSafe<T extends z.AnyZodObject>(data: unknown, schema: T){
        const result = schema.safeParse(data) 
        if(result.success){
            return result.data as z.infer<T>
        } else {
            throw new Error(`Coulnd't parse provided State with Zod. State is either corrupted and not compatible with this Cloudy Pad version. If you think this is a bug, please create an issue. Error state: ${JSON.stringify(data)}; Zod error: ${JSON.stringify(result.error.format())}`)
        }
    }

}