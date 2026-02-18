import * as gcp from "@pulumi/gcp"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { GcpPulumiClientArgs } from "./main"

//
// Base Image Snapshot Pulumi Stack
// Creates a GCP Image from the boot disk that can be used to create new instances.
// This captures the fully configured system (NVIDIA drivers, Cloudy Pad, etc.) as a reusable image.
//
// Flow: Boot Disk -> Snapshot -> Image
//

interface GcpBaseImageArgs {
    /**
     * ID of the root disk to create image from
     */
    rootVolumeId?: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadGcpBaseImage extends pulumi.ComponentResource {
    
    public readonly imageId: pulumi.Output<string>

    constructor(name: string, args: GcpBaseImageArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:gcp:base-image", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => {
            const tagMap: { [key: string]: string } = {}
            tags.forEach((tag) => {
                // Use tag as both key and value, or extract key:value if tag contains ':'
                if (tag.includes(':')) {
                    const [key, ...valueParts] = tag.split(':')
                    tagMap[key] = valueParts.join(':')
                } else {
                    tagMap[tag] = tag
                }
            })
            return tagMap
        })

        const commonPulumiOpts = {
            parent: this
        }

        // First create a Snapshot from the root disk
        // Snapshot is required to create an Image
        // Note: rootVolumeId is checked at program level, safe to assert non-null here
        const diskSnapshot = new gcp.compute.Snapshot(`${name}-base-image`, {
            name: `${name}-base-image`.toLowerCase(),
            sourceDisk: args.rootVolumeId!,
            labels: globalTags,
        }, {
            ...commonPulumiOpts,
            // Delete snapshot before replacing it to avoid duplicate resource errors
            deleteBeforeReplace: true,
            replaceOnChanges: ["sourceDisk"],
            // Snapshot creation can take a long time for large volumes
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        // Then create an Image from the snapshot
        // This image can be used directly in the Instance's image field
        const image = new gcp.compute.Image(`${name}-base-image`, {
            name: `${name}-base-image`.toLowerCase(),
            sourceSnapshot: diskSnapshot.selfLink,
            labels: globalTags,
        }, {
            ...commonPulumiOpts,
            // Delete image before replacing it to avoid duplicate resource errors
            deleteBeforeReplace: true,
            replaceOnChanges: ["sourceSnapshot"],
            // Image creation can take a long time for large volumes
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        this.imageId = image.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function gcpBaseImagePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const rootVolumeId = config.get("rootVolumeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    // Only create base image if rootVolumeId is provided
    if (!rootVolumeId) {
        return {}
    }

    const baseImage = new CloudyPadGcpBaseImage(stackName, {
        rootVolumeId: rootVolumeId,
        additionalTags: additionalTags,
    })

    return {
        imageId: baseImage.imageId,
    }
}

export interface GcpBaseImagePulumiStackConfig {
    instanceName: string
    projectId: string
    region: string
    zone: string

    /**
     * ID of the root disk to create image from. If undefined, 
     * no-op. Any existing image is KEPT and no new image is created.
     */
    rootVolumeId?: string
}

export interface GcpBaseImagePulumiOutput {
    /**
     * ID of the created Image
     */
    imageId?: string
}

export class GcpBaseImagePulumiClient extends InstancePulumiClient<GcpBaseImagePulumiStackConfig, GcpBaseImagePulumiOutput> {

    constructor(args: GcpPulumiClientArgs){
        super({ 
            program: gcpBaseImagePulumiProgram, 
            projectName: "CloudyPad-GCP-BaseImage", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: GcpBaseImagePulumiStackConfig){
        this.logger.debug(`Setting base image snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("gcp:project", { value: config.projectId})
        await stack.setConfig("gcp:region", { value: config.region})
        await stack.setConfig("gcp:zone", { value: config.zone})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.rootVolumeId) await stack.setConfig("rootVolumeId", { value: config.rootVolumeId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`GCP base image snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<GcpBaseImagePulumiOutput> {
        return {
            imageId: outputs["imageId"]?.value
        }
    }
}
