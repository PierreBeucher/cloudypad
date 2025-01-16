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


export interface GenericStateParserArgs {
    zodSchema: z.AnyZodObject
}

export abstract class GenericStateParser<S extends InstanceStateV1> {

    private zodSchema: z.AnyZodObject

    constructor(private args: GenericStateParserArgs) {
        this.zodSchema = args.zodSchema
    }
    
    public abstract parse(rawState: unknown): S

    protected zodParseSafe<T extends z.AnyZodObject>(data: unknown, schema: T): z.infer<T>{
        const result = schema.safeParse(data) 
        if(result.success){
            return result.data as z.infer<T>
        } else {
            throw new Error(`Coulnd't parse provided State with Zod. State is either corrupted and not compatible with this Cloudy Pad version. If you think this is a bug, please create an issue. Error state: ${JSON.stringify(data)}; Zod error: ${JSON.stringify(result.error.format())}`)
        }
    }
}

export class AnonymousStateParser extends GenericStateParser<InstanceStateV1> {

    constructor() {
        super({ zodSchema: InstanceStateV1Schema })
    }

    parse(rawState: unknown): InstanceStateV1 {
        return this.zodParseSafe(rawState, InstanceStateV1Schema)
    }
}