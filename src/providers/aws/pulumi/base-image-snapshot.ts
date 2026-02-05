import * as aws from "@pulumi/aws"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { AwsPulumiClientArgs } from "./main"

//
// Base Image Snapshot Pulumi Stack
// Creates an AMI from the root disk volume that can be used to boot new instances.
// This captures the fully configured system (NVIDIA drivers, Cloudy Pad, etc.) as a reusable image.
//
// Flow: Root Volume -> EBS Snapshot -> AMI
//

interface AwsBaseImageArgs {
    /**
     * ID of the root disk volume to create image from
     */
    rootVolumeId: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadAwsBaseImage extends pulumi.ComponentResource {
    
    public readonly imageId: pulumi.Output<string>

    constructor(name: string, args: AwsBaseImageArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:aws:base-image", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => [
            name,
            ...tags
        ])

        const commonPulumiOpts = {
            parent: this
        }

        // First create an EBS Snapshot from the root volume
        // EBS Snapshot is required to create an AMI
        const volumeSnapshot = new aws.ebs.Snapshot(`${name}-base-image`, {
            volumeId: args.rootVolumeId,
            tags: globalTags.apply(gt => {
                const tagMap: { [key: string]: string } = {
                    Name: `${name}-base-image`
                }
                gt.forEach((tag) => {
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
        }, {
            ...commonPulumiOpts,

            // delete existing snapshot before replacing it
            // and force replacement of snapshot if volumeId changes
            deleteBeforeReplace: true,
            replaceOnChanges: ["volumeId"],

            // snapshot creation can take a long time for large volumes
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        // Then create an AMI from the snapshot
        // This AMI can be used directly in the Instance's ami field
        const image = new aws.ec2.Ami(`${name}-base-image`, {
            name: `${name}-base-image`,
            rootDeviceName: "/dev/sda1",
            virtualizationType: "hvm",
            enaSupport: true, // Enable ENA for g4dn instances and other instance types that require it
            ebsBlockDevices: [{
                deviceName: "/dev/sda1",
                snapshotId: volumeSnapshot.id,
            }],
            tags: globalTags.apply(gt => {
                const tagMap: { [key: string]: string } = {
                    Name: `${name}-base-image`
                }
                gt.forEach((tag) => {
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
        }, {
            ...commonPulumiOpts,

            // delete existing AMI before replacing it
            // and force replacement of AMI if ebsBlockDevices changes
            deleteBeforeReplace: true,
            replaceOnChanges: ["ebsBlockDevices"],
            
            // AMI creation can take a long time for large volumes
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        this.imageId = image.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function awsBaseImagePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const rootVolumeId = config.require("rootVolumeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    const baseImage = new CloudyPadAwsBaseImage(stackName, {
        rootVolumeId: rootVolumeId,
        additionalTags: additionalTags,
    })

    return {
        imageId: baseImage.imageId,
    }
}

export interface PulumiStackConfigAwsBaseImage {
    instanceName: string
    region: string

    /**
     * ID of the root disk volume to create image from.
     */
    rootVolumeId: string
}

export interface AwsBaseImagePulumiOutput {
    /**
     * ID of the created AMI
     */
    imageId?: string
}

export class AwsBaseImagePulumiClient extends InstancePulumiClient<PulumiStackConfigAwsBaseImage, AwsBaseImagePulumiOutput> {

    constructor(args: AwsPulumiClientArgs){
        super({ 
            program: awsBaseImagePulumiProgram, 
            projectName: "CloudyPad-AWS-BaseImage", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigAwsBaseImage){
        this.logger.debug(`Setting base image snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("aws:region", { value: config.region})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.rootVolumeId) await stack.setConfig("rootVolumeId", { value: config.rootVolumeId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`AWS base image snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<AwsBaseImagePulumiOutput> {
        return {
            imageId: outputs["imageId"]?.value
        }
    }
}

