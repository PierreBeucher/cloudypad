import * as pulumi from "@pulumi/pulumi";
import { GcpClient } from "../sdk-client";

// Resolved inputs received by the provider at runtime
interface DiskResizerInputs {
    projectId: string;
    zone: string;
    diskName: string;
    sizeGb: number;
}

// Public args accepted by the Resource (can be Outputs)
export interface DiskResizerArgs {
    projectId: pulumi.Input<string>;
    zone: pulumi.Input<string>;
    diskName: pulumi.Input<string>;
    sizeGb: pulumi.Input<number>;
}

interface DiskResizerState extends DiskResizerInputs {
    appliedSizeGb: number;
}

export class DiskResizerProvider implements pulumi.dynamic.ResourceProvider {
    async check(_olds: unknown, news: DiskResizerInputs) {
        // Basic shape pass-through; Pulumi will validate types.
        return { inputs: news };
    }

    async diff(id: pulumi.ID, olds: DiskResizerState, news: DiskResizerInputs) {
        const replaces: string[] = [];
        const changes = olds.sizeGb !== news.sizeGb;
        const stables = ["projectId", "zone", "diskName"]; // treat identity as stable
        return { changes, replaces, stables }; // in-place update when size changes
    }

    async create(inputs: DiskResizerInputs) {
        const appliedSizeGb = await this.ensureSize(inputs);
        const id = `${inputs.projectId}/${inputs.zone}/${inputs.diskName}`;
        const outs: DiskResizerState = { ...inputs, appliedSizeGb };
        return { id, outs };
    }

    async update(id: pulumi.ID, olds: DiskResizerState, news: DiskResizerInputs) {
        const appliedSizeGb = await this.ensureSize(news);
        const outs: DiskResizerState = { ...news, appliedSizeGb };
        return { outs };
    }

    async delete(): Promise<void> {
        // No-op: we don't shrink or delete disks here.
    }

    private async ensureSize(inputs: DiskResizerInputs): Promise<number> {
        const { projectId, zone, diskName, sizeGb } = inputs;
        const client = new GcpClient(DiskResizerProvider.name, projectId);
        const actual = await client.getDiskSizeGb(zone, diskName);
        if (actual === undefined) {
            throw new Error(`Boot disk '${diskName}' not found in ${zone}/${projectId}.`);
        }
        pulumi.log.info(`Disk '${diskName}' in ${zone}/${projectId}: current ${actual} GiB, requested ${sizeGb} GiB`);
        if (sizeGb < actual) {
            throw new Error(`GCP persistent disks cannot shrink (current: ${actual}GB, requested: ${sizeGb}GB).`);
        }
        if (sizeGb === actual) {
            pulumi.log.info(`No resize needed for disk '${diskName}' (already ${actual} GiB).`);
            return actual;
        }
        pulumi.log.info(`Resizing disk '${diskName}' from ${actual} → ${sizeGb} GiB...`);
        await client.resizeDisk(zone, diskName, sizeGb);
        pulumi.log.info(`Resized disk '${diskName}' to ${sizeGb} GiB.`);
        return sizeGb;
    }
}

export class DiskResizer extends pulumi.dynamic.Resource {
    public readonly appliedSizeGb!: pulumi.Output<number>;
    constructor(name: string, args: DiskResizerArgs, opts?: pulumi.CustomResourceOptions) {
        super(new DiskResizerProvider(), name, { ...args, appliedSizeGb: undefined }, opts);
    }
}
