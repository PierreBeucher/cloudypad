import * as aws from "@pulumi/aws"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { AwsPulumiClientArgs } from "./main"

//
// Data Disk Snapshot Pulumi Stack
// Separate stack to manage data disk snapshots independently from main instance infrastructure
//

interface AwsDataDiskSnapshotArgs {
    /**
     * ID of the data disk volume to create snapshot from
     */
    volumeId: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadAwsDataDiskSnapshot extends pulumi.ComponentResource {
    
    public readonly snapshotId: pulumi.Output<string>

    constructor(name: string, args: AwsDataDiskSnapshotArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:aws:data-disk-snapshot", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => [
            name,
            ...tags
        ])

        const commonPulumiOpts = {
            parent: this
        }

        const snapshot = new aws.ebs.Snapshot(`${name}-data-volume-snapshot`, {
            volumeId: args.volumeId as pulumi.Input<string>,
            tags: globalTags.apply(gt => {
                const tagMap: { [key: string]: string } = {
                    Name: `${name}-data-volume-snapshot`
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
            // EBS snapshot creation can take a long time for large volumes
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        this.snapshotId = snapshot.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function awsDataDiskSnapshotPulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const volumeId = config.require("volumeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    const snapshot = new CloudyPadAwsDataDiskSnapshot(stackName, {
        volumeId: volumeId,
        additionalTags: additionalTags,
    })

    return {
        snapshotId: snapshot.snapshotId,
    }
}

export interface PulumiStackConfigAwsDataDiskSnapshot {
    instanceName: string
    region: string

    /**
     * ID of the data disk volume to snapshot. If undefined, 
     * no-op. Any existing snapshot is KEPT and no new snapshot is created.
     */
    baseVolumeId: string
}

export interface AwsDataDiskSnapshotPulumiOutput {
    /**
     * ID of the created snapshot
     */
    snapshotId?: string
}

export class AwsDataDiskSnapshotPulumiClient extends InstancePulumiClient<PulumiStackConfigAwsDataDiskSnapshot, AwsDataDiskSnapshotPulumiOutput> {

    constructor(args: AwsPulumiClientArgs){
        super({ 
            program: awsDataDiskSnapshotPulumiProgram, 
            projectName: "CloudyPad-AWS-DataDiskSnapshot", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigAwsDataDiskSnapshot){
        this.logger.debug(`Setting snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("aws:region", { value: config.region})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        await stack.setConfig("volumeId", { value: config.baseVolumeId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`AWS snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<AwsDataDiskSnapshotPulumiOutput> {
        return {
            // may be undefined since outputs may be read from stack while it didn't run yet
            snapshotId: outputs["snapshotId"]?.value
        }
    }
}

