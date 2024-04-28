import { z } from "zod"
import { CloudyBoxLogObjI, componentLogger } from "../../lib/logging.js"
import { Logger } from "tslog";

export const BoxSchemaBaseZ = z.object({
    kind: z.string(),
    name: z.string()
})

export type BoxSchemaBase = z.infer<typeof BoxSchemaBaseZ>

export interface BoxOutputs {

}

/**
 * Generic info about a Box. 
 */
export interface BoxMetadata {
    /**
     * Unique name for of Box across it's Kind
     */
    readonly name: string

    /**
     * The type of box
     */
    readonly kind: string

    /**
     * Context in which this Box is used
     */
    readonly context: string
}

/**
 * Arguments to pass to Box constructor.
 */
export type BoxConstructorMetadata = Omit<BoxMetadata, "kind">

/**
 * Base Box implementation with Kind, Name and common functions
 */
export abstract class BaseBox {
    readonly metadata: BoxMetadata

    readonly logger: Logger<CloudyBoxLogObjI>

    constructor(meta: BoxMetadata){
        this.metadata = meta
        this.logger = componentLogger.getSubLogger({ name: `${meta.kind}:${meta.name}` })
    }

    async getMetadata() : Promise<BoxMetadata>{
        return this.metadata
    }

    abstract get() : Promise<BoxOutputs>

    abstract stop() : Promise<void>

    abstract start() : Promise<void>

    abstract restart() : Promise<void>

}

/**
 * A Box Provisioner manages resources via a Provider (eg. AWS, GCP, Azure...)
 * using underlying Infrastructure as Code tool. 
 */
export interface ProvisionerBox extends BaseBox {

    provision() : Promise<BoxOutputs>

    destroy() : Promise<void>

    preview() : Promise<string>

    refresh() : Promise<BoxOutputs>
}

export const MachineBoxProvisionerInstanceZ = z.object({
    name: z.string().describe("Instance name. Notion of 'name' vary accross provider so this is only for informational purpose. Use ID for provider-specific pointer to instance."),
    address: z.string().optional().describe("IP or hostname on which this machine is reachable"),
    id: z.string().describe("Unique ID of the machine's instance within provider")
})

export const MachineBoxProvisionerInstanceWithAddressZ = MachineBoxProvisionerInstanceZ.merge(z.object({
    address: z.string().describe("IP or hostname on which this machine is reachable"),
}))

export const MachineBoxProvisionerOutputZ = z.object({
    instances: z.array(MachineBoxProvisionerInstanceZ)
})
export type MachineBoxProvisionerInstance = z.infer<typeof MachineBoxProvisionerInstanceZ>
export type MachineBoxProvisionerOutput = z.infer<typeof MachineBoxProvisionerOutputZ>
export type MachineBoxProvisionerInstanceWithAddress = z.infer<typeof MachineBoxProvisionerInstanceWithAddressZ>

/**
 * Box provisioner deploying more or one machines in the Cloud
 */
export interface MachineBoxProvisioner extends ProvisionerBox {

    get() : Promise<MachineBoxProvisionerOutput>
}

/**
 * A Box Configurator configure a Box, typically a VM but not necessarily.
 * It uses underlying tool like NixOS or Ansible. 
 */
export interface ConfiguratorBox {

    configure() : Promise<BoxOutputs>

}

/**
 * A Box Manager manages both provision and configuration of resources. 
 * It typically deploy a cloud VM or resources and manage configurations. 
 */
export interface ManagerBox extends BaseBox, ProvisionerBox, ConfiguratorBox {

   deploy() : Promise<BoxOutputs>

}

/**
 * A DeepPartial type inspired from https://stackoverflow.com/questions/61132262/typescript-deep-partial
 */
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T
