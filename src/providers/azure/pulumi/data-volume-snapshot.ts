import * as az from "@pulumi/azure-native"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { AzurePulumiClientArgs } from "./main"

//
// Data Disk Snapshot Pulumi Stack
// Separate stack to manage data disk snapshots independently from main instance infrastructure
//

interface AzureDataDiskSnapshotArgs {
    /**
     * ID of the data disk to snapshot
     */
    diskId?: pulumi.Input<string>
    resourceGroupName: pulumi.Input<string>
    location: pulumi.Input<string>
    additionalTags: pulumi.Input<string[]>
}

class CloudyPadAzureDataDiskSnapshot extends pulumi.ComponentResource {
    
    public readonly snapshotId: pulumi.Output<string>

    constructor(name: string, args: AzureDataDiskSnapshotArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:azure:data-disk-snapshot", name, args, opts)

        const globalTags = pulumi.all([args.additionalTags]).apply(([tags]) => {
            const tagMap: { [key: string]: string } = {
                Name: `${name}-data-disk-snapshot`
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

        const snapshot = new az.compute.Snapshot(`${name}-data-volume-snapshot`, {
            snapshotName: `${name}-data-disk-snapshot`,
            resourceGroupName: args.resourceGroupName,
            location: args.location,
            creationData: {
                createOption: "Copy",
                sourceResourceId: args.diskId,
            },
            tags: globalTags,
        }, {
            ...commonPulumiOpts,
            // delete existing snapshot before replacing it
            // and force replacement of snapshot if diskId changes
            deleteBeforeReplace: true,
            replaceOnChanges: ["creationData.sourceResourceId"],
            // Snapshot creation can take time for large disks
            customTimeouts: {
                create: "1h",
                update: "1h"
            }
        })

        this.snapshotId = snapshot.id
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function azureDataDiskSnapshotPulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const diskId = config.get("diskId")
    const resourceGroupName = config.require("resourceGroupName")
    const location = config.require("location")
    const additionalTags = config.getObject<string[]>("additionalTags") || []

    const stackName = pulumi.getStack()

    // Only create snapshot if diskId is provided
    if (!diskId) {
        return {}
    }

    const snapshot = new CloudyPadAzureDataDiskSnapshot(stackName, {
        diskId: diskId,
        resourceGroupName: resourceGroupName,
        location: location,
        additionalTags: additionalTags,
    })

    return {
        snapshotId: snapshot.snapshotId,
    }
}

export interface PulumiStackConfigAzureDataDiskSnapshot {
    instanceName: string
    resourceGroupName: string
    location: string
    subscriptionId: string

    /**
     * ID of the data disk to snapshot. If undefined, 
     * no-op. Any existing snapshot is KEPT and no new snapshot is created.
     */
    baseDiskId?: string
}

export interface AzureDataDiskSnapshotPulumiOutput {
    /**
     * ID of the created snapshot
     */
    snapshotId?: string
}

export class AzureDataDiskSnapshotPulumiClient extends InstancePulumiClient<PulumiStackConfigAzureDataDiskSnapshot, AzureDataDiskSnapshotPulumiOutput> {

    constructor(args: AzurePulumiClientArgs){
        super({ 
            program: azureDataDiskSnapshotPulumiProgram, 
            projectName: "CloudyPad-Azure-DataDiskSnapshot", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigAzureDataDiskSnapshot){
        this.logger.debug(`Setting snapshot stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("azure-native:subscriptionId", { value: config.subscriptionId})
        await stack.setConfig("azure-native:location", { value: config.location})
        await stack.setConfig("resourceGroupName", { value: config.resourceGroupName})
        await stack.setConfig("location", { value: config.location})
        await stack.setConfig("additionalTags", { value: JSON.stringify([`instance:${config.instanceName}`])})
        if(config.baseDiskId) await stack.setConfig("diskId", { value: config.baseDiskId})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Azure snapshot stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<AzureDataDiskSnapshotPulumiOutput> {
        return {
            // may be undefined since outputs may be read from stack while it didn't run yet
            snapshotId: outputs["snapshotId"]?.value
        }
    }
}

