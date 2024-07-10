import * as fs from 'fs'
import * as yaml from "js-yaml"
import { BoxSchemaBaseZ, ManagerBox } from "../boxes/common/base.js"
import { PROJECT_KIND_REPLICATED_EC2_INSTANCE, ReplicatedEC2ManagerBox } from '../boxes/aws/replicated-ec2.js'
import { PROJECT_KIND_GAMING_WOLF, WolfManagerBox } from '../boxes/gaming/wolf.js'
import { PROJECT_KIND_LINUX_REPLICATED_NIXOS, NixOSManagerBox } from '../boxes/nix/manager.js'
import { PROJECT_KIND_PAPERSPACE_MACHINE, PaperspaceManagerBox } from '../boxes/paperspace/manager.js';
import { mainLogger } from './logging.js'
import { PROJECT_KIND_GAMING_SUNSHINE, SunshineManagerBox } from '../boxes/gaming/sunshine.js'

export const KIND_TO_MANAGER_MAP = new Map<string, (s: unknown) => Promise<ManagerBox>>([
    [PROJECT_KIND_GAMING_WOLF, WolfManagerBox.parseSpec],
    [PROJECT_KIND_REPLICATED_EC2_INSTANCE, ReplicatedEC2ManagerBox.parseSpec],
    [PROJECT_KIND_LINUX_REPLICATED_NIXOS, NixOSManagerBox.parseSpec],
    [PROJECT_KIND_PAPERSPACE_MACHINE, PaperspaceManagerBox.parseSpec],
    [PROJECT_KIND_GAMING_SUNSHINE, SunshineManagerBox.parseSpec]
]);

export async function getManagerBox(path: string) : Promise<ManagerBox> {

    const plainConfig = yaml.load(fs.readFileSync(path, "utf-8"))
    const baseConfig = await BoxSchemaBaseZ.parseAsync((plainConfig))

    mainLogger.info(`Parsed box config ${baseConfig.kind}:${baseConfig.name}`)
    
    const schema = KIND_TO_MANAGER_MAP.get(baseConfig.kind)
    if(!schema){
        throw new Error(`Box schema for kind ${baseConfig.kind} not found.`)
    }

    const result = schema(plainConfig)

    return result
}