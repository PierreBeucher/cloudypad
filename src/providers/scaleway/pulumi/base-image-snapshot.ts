import * as scw from "@pulumiverse/scaleway"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { ScalewayPulumiClientArgs } from "./main"

//
// Base Image Snapshot Pulumi Stack
// Creates an Instance Image from the root disk volume that can be used to boot new servers.
// This captures the fully configured system (NVIDIA drivers, Cloudy Pad, etc.) as a reusable image.
//
// Flow: Volume -> Instance Snapshot -> Instance Image
//

interface ScalewayBaseImageArgs {
    /**
     * ID of the root disk volume to create image from
     */
    rootVolumeId?: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadScalewayBaseImage extends pulumi.ComponentResource {
    
    public readonly imageId: pulumi.Output<string>

    constructor(name: string, args: ScalewayBaseImageArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:scaleway:base-image", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => [
            name,
            ...tags
        ])

        const commonPulumiOpts = {
            parent: this
        }

        // First create an Instance Snapshot from the root volume
        // Instance Snapshot is required to create an Instance Image
        const volumeSnapshot = new scw.block.Snapshot(`${name}-base-image`, {
            name: `${name}-base-image`,
            volumeId: args.rootVolumeId,
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            deleteBeforeReplace: true,
            replaceOnChanges: ["volumeId"]
        })

        // Then create an Instance Image from the snapshot
        // This image can be used directly in the Server's image field
        const image = new scw.instance.Image(`${name}-base-image`, {
            name: `${name}-base-image`,
            rootVolumeId: volumeSnapshot.id,
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            deleteBeforeReplace: true,
            replaceOnChanges: ["rootVolumeId"]
        })

        // image id looks like this: "fr-par-2/4becedc8-51e9-4320-a45c-20f0f57033fa"
        // we want to extract only the ID
        this.imageId = image.id.apply(id => id.split("/").pop() as string)
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function scalewayBaseImagePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const rootVolumeId = config.get("rootVolumeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    const baseImage = new CloudyPadScalewayBaseImage(stackName, {
        rootVolumeId: rootVolumeId,
        additionalTags: additionalTags,
    })

    return {
        imageId: baseImage.imageId,
    }
}

export interface ScalewayBaseImagePulumiStackConfig {
    instanceName: string
    projectId: string
    region: string
    zone: string

    /**
     * ID of the root disk volume to create image from. If undefined, 
     * no-op. Any existing image is KEPT and no new image is created.
     */
    rootVolumeId?: string
}

export interface ScalewayBaseImagePulumiOutput {
    /**
     * ID of the created Instance Image
     */
    imageId?: string
}

export class ScalewayBaseImagePulumiClient extends InstancePulumiClient<ScalewayBaseImagePulumiStackConfig, ScalewayBaseImagePulumiOutput> {

    constructor(args: ScalewayPulumiClientArgs){
        super({ 
            program: scalewayBaseImagePulumiProgram, 
            projectName: "CloudyPad-Scaleway-BaseImage", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: ScalewayBaseImagePulumiStackConfig){
        this.logger.debug(`Setting base image snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("scaleway:project_id", { value: config.projectId})
        await stack.setConfig("scaleway:region", { value: config.region})
        await stack.setConfig("scaleway:zone", { value: config.zone})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.rootVolumeId) await stack.setConfig("rootVolumeId", { value: config.rootVolumeId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Scaleway base image snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<ScalewayBaseImagePulumiOutput> {
        return {
            imageId: outputs["imageId"]?.value
        }
    }
}


