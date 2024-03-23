import { ConfigMap } from "@pulumi/pulumi/automation";
import { PulumiClient } from "../../lib/infra/pulumi/pulumi-client.js";
import { ec2InstanceProgram } from "../../lib/infra/pulumi/programs/ec2-instance.js";
import { CloudVMBoxManager, outputsFromPulumi } from "../common/cloud-virtual-machine.js";
import { AwsClient } from "../../lib/infra/aws/client.js";
import { BoxMetadata } from "../../lib/core.js";
import { z } from "zod";
import { BOX_SCHEMA_BASE } from "../common/base.js";

export const KIND_EC2_INSTANCE = "aws.ec2.Instance"

export const BOX_SCHEMA_EC2_INSTANCE_SPEC = z.object({
    config: z.object({
        region: z.string()
    }),
    instance: z.object({
        ami: z.string(),
        type: z.string(),
        publicKey: z.string(),
        availabilityZone: z.string().optional(),
        rootVolume: z.object({
            sizeGb: z.number().optional(),
            type: z.string().optional(),
            encrypted: z.boolean().optional(),
        }).optional(),
    }),
    volumes: z.array(z.object({
        size: z.number(),
        type: z.string().optional(),
        deviceName: z.string(),
        encrypted: z.boolean().optional(),
        availabilityZone: z.string().optional(),
        iops: z.number().optional(),
        throughput: z.number().optional(),
    })).optional(),
    ingressPorts: z.array(z.object({
        from: z.number(),
        to: z.number().optional(),
        protocol: z.string().optional(),
        cidrBlocks: z.array(z.string()).optional(),
        ipv6CirdBlocks: z.array(z.string()).optional(),
    })).optional(),
    dns: z.object({
        zoneName: z.string().optional(),
        zoneId: z.string().optional(),
        records: z.array(z.object({
            fqdn: z.string(),
            ttl: z.number(),
            type: z.string(),
        })).optional(),
    }).optional(),
    network: z.object({
        vpcId: z.string().optional(),
        subnetId: z.string().optional(),
        staticIpEnable: z.boolean(),
    }).optional(),
    tags: z.record(z.string()).optional(),
})

/**
 * Matches CompositeEC2InstanceArgs
 */
export const BOX_SCHEMA_EC2_INSTANCE = BOX_SCHEMA_BASE.extend({
    spec: BOX_SCHEMA_EC2_INSTANCE_SPEC
})

export type EC2InstanceBoxManagerArgs = z.infer<typeof BOX_SCHEMA_EC2_INSTANCE_SPEC>

export class EC2InstanceBoxManager implements CloudVMBoxManager {

    readonly args: EC2InstanceBoxManagerArgs
    readonly pulumiClient: PulumiClient
    readonly awsClient: AwsClient
    readonly meta: BoxMetadata

    constructor(name: string, spec: EC2InstanceBoxManagerArgs) {
        this.meta = new BoxMetadata({ name: name, kind: KIND_EC2_INSTANCE })
        this.args = spec
        this.pulumiClient = buildPulumiClient(name, spec)
        this.awsClient = new AwsClient({ region: spec.config?.region })
    }

    public async deploy() {
        await this.provision()
        const o = await this.configure()
        return o
    }

    async provision() {
        const o = await this.pulumiClient.up()
        return outputsFromPulumi(o)
    }

    async destroy() {
        return this.pulumiClient.destroy()
    }

    async preview() {
        return this.pulumiClient.preview()
    }

    async configure() {
        // NO OP
        return this.get()
    }

    async get() {
        const o = await this.pulumiClient.get()
        return outputsFromPulumi(o)
    }

    async stop() {
        const o = await this.get()
        await this.awsClient.stopInstance(o.id)
    }

    async start() {
        const o = await this.get()
        await this.awsClient.startInstance(o.id)
    }

    async restart() {
        const o = await this.get()
        await this.awsClient.rebootInstance(o.id)
    }

    async getMetadata(): Promise<BoxMetadata> {
        return this.meta
    }
}

export async function parseAWSEC2InstanceSpec(rawConfig: unknown) : Promise<EC2InstanceBoxManager> {
    const config = await BOX_SCHEMA_EC2_INSTANCE.parseAsync(rawConfig)
    return new EC2InstanceBoxManager(config.name, config.spec)
}

function buildPulumiClient(name: string, args: EC2InstanceBoxManagerArgs): PulumiClient {

    const pulumiConfig: ConfigMap = {}
    if (args.config?.region) {
        pulumiConfig["aws:region"] = { value: args.config.region }
    }

    return new PulumiClient({
        stackName: name,
        projectName: `cloudybox-aws-ec2-instance`,
        program: async () => {
            return ec2InstanceProgram(name, args)
        },
        config: pulumiConfig
    })
}