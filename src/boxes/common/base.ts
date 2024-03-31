import { z } from "zod"

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
}

/**
 * Base Box implementation with Kind, Name and common functions
 */
export abstract class BoxBase {
    readonly metadata: BoxMetadata

    constructor(meta: BoxMetadata){
        this.metadata = meta
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
export interface BoxProvisioner extends BoxBase {

    provision() : Promise<BoxOutputs>

    destroy() : Promise<void>

    preview() : Promise<string>

}

/**
 * A Box Configurator configure a Box, typically a VM but not necessarily.
 * It uses underlying tool like NixOS or Ansible. 
 */
export interface BoxConfigurator {

    configure() : Promise<BoxOutputs>

}

/**
 * A Box Manager manages both provision and configuration of resources. 
 * It typically deploy a cloud VM or resources and manage configurations. 
 */
export interface BoxManager extends BoxBase, BoxProvisioner, BoxConfigurator {

   deploy() : Promise<BoxOutputs>

}