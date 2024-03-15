import { z } from "zod"
import * as fs from 'fs'
import { parseWolfBoxSpec } from "../boxes/gaming/wolf.js"
import * as yaml from "js-yaml"
import { BOX_SCHEMA_BASE } from "../boxes/common/base.js"

export interface BoxManagerOutputs {

}

export interface BoxManager {

    deploy() : Promise<BoxManagerOutputs>

    provision() : Promise<BoxManagerOutputs>
    
    destroy() : Promise<void>

    preview() : Promise<string>

    get() : Promise<BoxManagerOutputs>

    stop() : Promise<void>

    start() : Promise<void>

    restart() : Promise<void>

    getMetadata() : Promise<BoxMetadata>
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


export type BoxSchemaBase = z.infer<typeof BOX_SCHEMA_BASE>

export const KIND_TO_MANAGER_MAP = new Map<string, (s: unknown) => Promise<BoxManager>>([
    ["gaming.Wolf", parseWolfBoxSpec],
    // ["linux.NixOS", BOX_SCHEMA_WOLF.parseAsync]
])

export async function getBoxManager(path: string) : Promise<BoxManager> {

    const plainConfig = yaml.load(fs.readFileSync(path, "utf-8"))
    const baseConfig = await BOX_SCHEMA_BASE.parseAsync((plainConfig))
    
    const schema = KIND_TO_MANAGER_MAP.get(baseConfig.kind)
    if(!schema){
        throw new Error(`Box schema for kind ${baseConfig.kind} not found.`)
    }

    const result = schema(plainConfig)

    return result
}