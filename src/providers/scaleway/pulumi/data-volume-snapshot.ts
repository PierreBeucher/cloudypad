import * as scw from "@pulumiverse/scaleway"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { ScalewayPulumiClientArgs } from "./main"

//
// Data Disk Snapshot Pulumi Stack
// Separate stack to manage data disk snapshots independently from main instance infrastructure
//

interface ScalewayDataDiskSnapshotArgs {
    /**
     * ID of the data disk volume to snapshot
     */
    volumeId?: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadScalewayDataDiskSnapshot extends pulumi.ComponentResource {
    
    public readonly snapshotId: pulumi.Output<string>

    constructor(name: string, args: ScalewayDataDiskSnapshotArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:scaleway:data-disk-snapshot", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => [
            name,
            ...tags
        ])

        const commonPulumiOpts = {
            parent: this
        }

        const snapshot = new scw.block.Snapshot(`${name}-data-volume-snapshot`, {
            name: `${name}-data-volume-snapshot`,
            volumeId: args.volumeId,
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            // delete existing snapshot before replacing it
            // and force replacement of snapshot if volumeId changes
            deleteBeforeReplace: true,
            replaceOnChanges: ["volumeId"]
        })

        // snapshot id looks like this: "fr-par-2/4becedc8-51e9-4320-a45c-20f0f57033fa"
        // we want to extract only the ID
        this.snapshotId = snapshot.id.apply(id => id.split("/").pop() as string)
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function scalewayDataDiskSnapshotPulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const volumeId = config.get("volumeId")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    const snapshot = new CloudyPadScalewayDataDiskSnapshot(stackName, {
        volumeId: volumeId,
        additionalTags: additionalTags,
    })

    return {
        snapshotId: snapshot.snapshotId,
    }
}

export interface PulumiStackConfigScalewayDataDiskSnapshot {
    instanceName: string
    projectId: string
    region: string
    zone: string

    /**
     * ID of the data disk volume to snapshot. If undefined, 
     * no-op. Any existing snapshot is KEPT and no new snapshot is created.
     */
    baseVolumeId?: string
}

export interface ScalewayDataDiskSnapshotPulumiOutput {
    /**
     * ID of the created snapshot
     */
    snapshotId: string
}

export class ScalewayDataDiskSnapshotPulumiClient extends InstancePulumiClient<PulumiStackConfigScalewayDataDiskSnapshot, ScalewayDataDiskSnapshotPulumiOutput> {

    constructor(args: ScalewayPulumiClientArgs){
        super({ 
            program: scalewayDataDiskSnapshotPulumiProgram, 
            projectName: "CloudyPad-Scaleway-DataDiskSnapshot", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigScalewayDataDiskSnapshot){
        this.logger.debug(`Setting snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("scaleway:project_id", { value: config.projectId})
        await stack.setConfig("scaleway:region", { value: config.region})
        await stack.setConfig("scaleway:zone", { value: config.zone})
        await stack.setConfig("instanceName", { value: config.instanceName})
        await stack.setConfig("additionalTags", { value: JSON.stringify([config.instanceName])})
        if(config.baseVolumeId) await stack.setConfig("volumeId", { value: config.baseVolumeId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Scaleway snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<ScalewayDataDiskSnapshotPulumiOutput> {
        return {
            snapshotId: outputs["snapshotId"]?.value as string
        }
    }
}