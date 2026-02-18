import * as az from "@pulumi/azure-native"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { AzurePulumiClientArgs } from "./main"

//
// Base Image Snapshot Pulumi Stack
// Creates an Azure Image from the OS disk snapshot that can be used to boot new VMs.
// This captures the fully configured system (NVIDIA drivers, Cloudy Pad, etc.) as a reusable image.
//
// Flow: OS Disk → Disk Snapshot → Image
//

interface AzureBaseImageArgs {
    /**
     * ID of the root disk to create image from
     */
    rootDiskId: pulumi.Input<string>
    resourceGroupName: pulumi.Input<string>
    location: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadAzureBaseImage extends pulumi.ComponentResource {
    
    public readonly imageId: pulumi.Output<string>

    constructor(name: string, args: AzureBaseImageArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:azure:base-image", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => {
            const tagMap: { [key: string]: string } = {
                Name: `${name}-base-image`
            }
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

        // First create a Disk Snapshot from the root disk
        // Disk Snapshot is required to create an Image
        const diskSnapshot = new az.compute.Snapshot(`${name}-base-image`, {
            snapshotName: `${name}-base-image`,
            resourceGroupName: args.resourceGroupName,
            location: args.location,
            creationData: {
                createOption: "Copy",
                sourceResourceId: args.rootDiskId,
            },
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            // delete existing snapshot before replacing it to avoid duplicate resource errors
            deleteBeforeReplace: true,
            replaceOnChanges: ["creationData.sourceResourceId"],
            // Snapshot creation can take time for large disks
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        // Then create an Image from the snapshot
        // This image can be used directly in the VM's imageReference field
        const image = new az.compute.Image(`${name}-base-image`, {
            imageName: `${name}-base-image`,
            resourceGroupName: args.resourceGroupName,
            location: args.location,
            storageProfile: {
                osDisk: {
                    osType: "Linux",
                    osState: "Generalized",
                    snapshot: {
                        id: diskSnapshot.id
                    },
                },
            },
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            // delete existing image before replacing it to avoid duplicate resource errors
            deleteBeforeReplace: true,
            // force replacement of image if snapshot changes
            replaceOnChanges: ["storageProfile.osDisk.snapshot"],
            // Image creation can take time
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        this.imageId = image.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function azureBaseImagePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const rootDiskId = config.require("rootDiskId")
    const resourceGroupName = config.require("resourceGroupName")
    const location = config.require("location")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    const baseImage = new CloudyPadAzureBaseImage(stackName, {
        rootDiskId: rootDiskId,
        resourceGroupName: resourceGroupName,
        location: location,
        additionalTags: additionalTags,
    })

    return {
        imageId: baseImage.imageId,
    }
}

export interface PulumiStackConfigAzureBaseImage {
    instanceName: string
    resourceGroupName: string
    location: string
    subscriptionId: string

    /**
     * ID of the root disk to create image from.
     */
    rootDiskId: string
}

export interface AzureBaseImagePulumiOutput {
    /**
     * ID of the created Image
     */
    imageId?: string
}

export class AzureBaseImagePulumiClient extends InstancePulumiClient<PulumiStackConfigAzureBaseImage, AzureBaseImagePulumiOutput> {

    constructor(args: AzurePulumiClientArgs){
        super({ 
            program: azureBaseImagePulumiProgram, 
            projectName: "CloudyPad-Azure-BaseImage", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigAzureBaseImage){
        this.logger.debug(`Setting base image snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("azure-native:subscriptionId", { value: config.subscriptionId})
        await stack.setConfig("azure-native:location", { value: config.location})
        await stack.setConfig("resourceGroupName", { value: config.resourceGroupName})
        await stack.setConfig("location", { value: config.location})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.rootDiskId) await stack.setConfig("rootDiskId", { value: config.rootDiskId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Azure base image snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<AzureBaseImagePulumiOutput> {
        return {
            imageId: outputs["imageId"]?.value
        }
    }
}

