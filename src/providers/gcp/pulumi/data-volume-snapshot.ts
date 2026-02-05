import * as gcp from "@pulumi/gcp"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { GcpPulumiClientArgs } from "./main"

//
// Data Disk Snapshot Pulumi Stack
// Separate stack to manage data disk snapshots independently from main instance infrastructure
//

interface GcpDataDiskSnapshotArgs {
    /**
     * ID of the data disk to snapshot
     */
    volumeId: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadGcpDataDiskSnapshot extends pulumi.ComponentResource {
    
    public readonly snapshotId: pulumi.Output<string>

    constructor(name: string, args: GcpDataDiskSnapshotArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:gcp:data-disk-snapshot", name, args, opts)

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

        const snapshot = new gcp.compute.Snapshot(`${name}-data-volume-snapshot`, {
            name: `${name}-data-volume-snapshot`.toLowerCase(),
            sourceDisk: args.volumeId,
            labels: globalTags,
        }, {
            ...commonPulumiOpts,
            // delete existing snapshot before replacing it
            // and force replacement of snapshot if volumeId changes
            deleteBeforeReplace: true,
            replaceOnChanges: ["sourceDisk"],
            // Snapshot creation can take a long time for large volumes
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        this.snapshotId = snapshot.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function gcpDataDiskSnapshotPulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const volumeId = config.get("volumeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    // Only create snapshot if volumeId is provided
    if (!volumeId) {
        return {}
    }

    const snapshot = new CloudyPadGcpDataDiskSnapshot(stackName, {
        volumeId: volumeId,
        additionalTags: additionalTags,
    })

    return {
        snapshotId: snapshot.snapshotId,
    }
}

export interface PulumiStackConfigGcpDataDiskSnapshot {
    instanceName: string
    projectId: string
    region: string
    zone: string

    /**
     * ID of the data disk to snapshot. If undefined, 
     * no-op. Any existing snapshot is KEPT and no new snapshot is created.
     */
    baseVolumeId?: string
}

export interface GcpDataDiskSnapshotPulumiOutput {
    /**
     * ID of the created snapshot
     */
    snapshotId?: string
}

export class GcpDataDiskSnapshotPulumiClient extends InstancePulumiClient<PulumiStackConfigGcpDataDiskSnapshot, GcpDataDiskSnapshotPulumiOutput> {

    constructor(args: GcpPulumiClientArgs){
        super({ 
            program: gcpDataDiskSnapshotPulumiProgram, 
            projectName: "CloudyPad-GCP-DataDiskSnapshot", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigGcpDataDiskSnapshot){
        this.logger.debug(`Setting snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("gcp:project", { value: config.projectId})
        await stack.setConfig("gcp:region", { value: config.region})
        await stack.setConfig("gcp:zone", { value: config.zone})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.baseVolumeId) await stack.setConfig("volumeId", { value: config.baseVolumeId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`GCP snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<GcpDataDiskSnapshotPulumiOutput> {
        return {
            // may be undefined since outputs may be read from stack while it didn't run yet
            snapshotId: outputs["snapshotId"]?.value
        }
    }
}
