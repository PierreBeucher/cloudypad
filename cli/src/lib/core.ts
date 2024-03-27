import * as fs from 'fs'
import { BOX_KIND_GAMING_WOLF, WolfBoxManager } from "../boxes/gaming/wolf.js"
import * as yaml from "js-yaml"
import { BoxSchemaBaseZ, BoxManager } from "../boxes/common/base.js"
import { BOX_KIND_COMPOSITE_EC2_INSTANCE, CompositeEC2BoxManager } from "../boxes/aws/composite-ec2.js"
import { BOX_KIND_LINUX_NIXOS, NixOSBoxManager } from "../boxes/nix/nixos.js"
import { BOX_KIND_REPLICATED_EC2_INSTANCE, ReplicatedEC2BoxManager } from '../boxes/aws/replicated-ec2.js'

export const KIND_TO_MANAGER_MAP = new Map<string, (s: unknown) => Promise<BoxManager>>([
    [BOX_KIND_GAMING_WOLF, WolfBoxManager.parseSpec],
    [BOX_KIND_COMPOSITE_EC2_INSTANCE, CompositeEC2BoxManager.parseSpec],
    [BOX_KIND_REPLICATED_EC2_INSTANCE, ReplicatedEC2BoxManager.parseSpec],
    [BOX_KIND_LINUX_NIXOS, NixOSBoxManager.parseSpec]
])

export async function getBoxManager(path: string) : Promise<BoxManager> {

    const plainConfig = yaml.load(fs.readFileSync(path, "utf-8"))
    const baseConfig = await BoxSchemaBaseZ.parseAsync((plainConfig))
    
    const schema = KIND_TO_MANAGER_MAP.get(baseConfig.kind)
    if(!schema){
        throw new Error(`Box schema for kind ${baseConfig.kind} not found.`)
    }

    const result = schema(plainConfig)

    return result
}