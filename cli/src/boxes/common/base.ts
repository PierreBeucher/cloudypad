import { z } from "zod"

export const BoxSchemaBaseZ = z.object({
    kind: z.string(),
    name: z.string()
})

export type BoxSchemaBase = z.infer<typeof BoxSchemaBaseZ>

export interface BoxManagerOutputs {

}

export abstract class BoxManager {

    readonly metadata: BoxMetadata

    constructor(meta: BoxMetadata){
        this.metadata = meta
    }

    async getMetadata() : Promise<BoxMetadata>{
        return this.metadata
    }

    abstract deploy() : Promise<BoxManagerOutputs>

    abstract provision() : Promise<BoxManagerOutputs>

    abstract configure() : Promise<BoxManagerOutputs>
    
    abstract destroy() : Promise<void>

    abstract preview() : Promise<string>

    abstract get() : Promise<BoxManagerOutputs>

    abstract stop() : Promise<void>

    abstract start() : Promise<void>

    abstract restart() : Promise<void>
}

export interface BoxMetadataArgs {
    name: string
    kind: string
}

export class BoxMetadata {
    public readonly kind: string
    public readonly name: string

    constructor(args: BoxMetadataArgs){
        this.kind = args.kind
        this.name = args.name
    }
}