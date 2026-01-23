import * as pulumi from "@pulumi/pulumi"
import * as linode from "@pulumi/linode"
import { LocalWorkspaceOptions, OutputMap } from "@pulumi/pulumi/automation"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { linodeLabel } from "./utils"

//
// Base Image Snapshot Pulumi Stack for Linode
// Separate stack to manage base images independently from main instance infrastructure
// Linode uses "Image" terminology - this creates an image that can be used to boot new instances
//

interface LinodeRootDiskImageArgs {
    /**
     * ID of the disk to create an image from
     */
    diskId?: pulumi.Input<number>
    
    /**
     * ID of the Linode instance the disk belongs to
     */
    linodeId?: pulumi.Input<number>
    
    /**
     * Description for the image
     */
    description?: pulumi.Input<string>
    
    /**
     * Additional tags to apply to resources
     */
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadLinodeRootDiskImage extends pulumi.ComponentResource {
    
    public readonly imageId: pulumi.Output<string>

    constructor(name: string, args: LinodeRootDiskImageArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:linode:root-disk-image", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => [
            name,
            ...tags
        ])

        const commonPulumiOpts = {
            parent: this
        }

        const image = new linode.Image(`${name}-root-image`, {
            label: linodeLabel(name, "-root-image"),
            diskId: args.diskId,
            linodeId: args.linodeId,
            description: args.description ?? `Cloudy Pad root disk image for ${name}`,
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            // delete existing image before replacing it
            deleteBeforeReplace: true,
            replaceOnChanges: ["diskId", "linodeId"]
        })

        // Image ID is like "private/12345678"
        this.imageId = image.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function linodeRootDiskImagePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const diskId = config.getNumber("diskId")
    const linodeId = config.getNumber("linodeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    const image = new CloudyPadLinodeRootDiskImage(stackName, {
        diskId: diskId,
        linodeId: linodeId,
        additionalTags: additionalTags,
    })

    return {
        imageId: image.imageId,
    }
}

export interface PulumiStackConfigLinodeRootDiskImage {
    /**
     * Name of the Cloudy Pad instance to create the base image for
     */
    instanceName: string

    /**
     * Linode API token
     */
    apiToken: string
    
    /**
     * ID of the disk to create an image from. If undefined, 
     * no-op. Any existing image is KEPT and no new image is created.
     */
    diskId?: number
    
    /**
     * ID of the Linode instance the disk belongs to
     */
    linodeId?: number
}

export interface LinodeRootDiskImagePulumiOutput {
    /**
     * ID of the created image (e.g., "private/12345678")
     */
    imageId: string
}

export interface LinodeBaseImageSnapshotPulumiClientArgs {
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
}

export class LinodeBaseImageSnapshotPulumiClient extends InstancePulumiClient<PulumiStackConfigLinodeRootDiskImage, LinodeRootDiskImagePulumiOutput> {

    constructor(args: LinodeBaseImageSnapshotPulumiClientArgs){
        super({ 
            program: linodeRootDiskImagePulumiProgram, 
            projectName: "CloudyPad-Linode-BaseImageSnapshot", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigLinodeRootDiskImage){
        this.logger.debug(`Setting base image stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("linode:token", { value: config.apiToken, secret: true })
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.diskId) await stack.setConfig("diskId", { value: config.diskId.toString() })
        if(config.linodeId) await stack.setConfig("linodeId", { value: config.linodeId.toString() })

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Linode base image stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<LinodeRootDiskImagePulumiOutput> {
        return {
            imageId: outputs["imageId"]?.value as string
        }
    }
}


