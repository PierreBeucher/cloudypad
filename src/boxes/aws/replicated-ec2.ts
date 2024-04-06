import { z } from 'zod';
import { DnsSchema, InstanceSchema, NetworkSchema, VolumeSchema } from './common.js';
import { BoxMetadata, BoxSchemaBaseZ } from '../common/base.js';
import { PulumiBoxManager } from '../pulumi/manager.js';
import { AwsClient } from '../../lib/infra/aws/client.js';
import { ReplicatedEC2instance } from '../../lib/infra/pulumi/components/aws/replicated-ec2.js';
import { OutputMap } from '@pulumi/pulumi/automation/stack.js';
import { pulumiOutputMapToPlainObject } from '../../lib/infra/pulumi/pulumi-client.js';
import * as pulumi from "@pulumi/pulumi"
import { boxLogger, CloudyBoxLogObjI } from "../../lib/logging.js"
import {  Logger } from 'tslog';

export const ReplicatedEC2InstanceBoxManagerSpecZ = z.object({
    awsConfig: z.object({ // TODO need a better way to handle that
        region: z.string()
    }),
    replicas: z.union([z.array(z.string()), z.number()]).optional(),
    publicKey: z.string(),
    network: NetworkSchema,
    dns: DnsSchema.optional(),
    tags: z.record(z.string()).optional(),
    instance: InstanceSchema,
    volumes: z.array(VolumeSchema).optional(),
});

export const ReplicatedEC2InstanceSchema = BoxSchemaBaseZ.extend({
    spec: ReplicatedEC2InstanceBoxManagerSpecZ,
})

export const ReplicatedEC2InstanceOutputZ = z.object({
    name: z.string(),
    publicIp: z.string(),
    instanceId: z.string(),
    fqdn: z.string().optional()
})

export const ReplicatedEC2InstanceOutputsZ = z.object({
    replicas: z.array(ReplicatedEC2InstanceOutputZ)
})

export type ReplicatedEC2InstanceOutputs = z.infer<typeof ReplicatedEC2InstanceOutputsZ>
export type ReplicatedEC2InstanceBoxManagerSpec = z.infer<typeof ReplicatedEC2InstanceBoxManagerSpecZ>
export type ReplicatedEC2InstanceOutput = z.infer<typeof ReplicatedEC2InstanceOutputZ>

export const BOX_KIND_REPLICATED_EC2_INSTANCE = "aws.ec2.ReplicatedInstance"

export interface ReplicatedEC2InstanceBoxManagerArgs {
    spec: ReplicatedEC2InstanceBoxManagerSpec
}

export class ReplicatedEC2BoxManager extends PulumiBoxManager<ReplicatedEC2InstanceOutputs> {
    
    static async parseSpec(source: unknown) : Promise<ReplicatedEC2BoxManager> {
        const config = ReplicatedEC2InstanceSchema.parse(source)
        return new ReplicatedEC2BoxManager(config.name, config)
    }

    readonly awsClient: AwsClient

    readonly logger: Logger<CloudyBoxLogObjI>

    constructor(name: string, args: ReplicatedEC2InstanceBoxManagerArgs) {

        const metadata : BoxMetadata = { name: name, kind: BOX_KIND_REPLICATED_EC2_INSTANCE }

        const pulumiFn = async ()  => {
            const instances = new ReplicatedEC2instance(`${metadata.name}`, args.spec)

            const replicas = instances.replicas.map(r => pulumi.all([ 
                    r.instance.id,
                    r.publicIp,
                    r.fqdn,
                ]).apply(([instanceId, ip, fqdn]) : ReplicatedEC2InstanceOutput => {
                    return {
                        publicIp: ip,
                        instanceId: instanceId,
                        fqdn: fqdn,
                        name: r.name
                    }
                })
            )

            return pulumi.all(replicas).apply( (reps) : ReplicatedEC2InstanceOutputs => {
                return {
                    replicas: reps
                }
            })
        }

        super({ 
                program: pulumiFn,
                config: {
                    "aws:region": { value: args.spec.awsConfig.region }
                },
                meta: { name: name, kind: BOX_KIND_REPLICATED_EC2_INSTANCE }
            },
        )
        
        this.logger = boxLogger.getSubLogger({ name: `${metadata.kind}:${metadata.name}` })
        this.awsClient = new AwsClient({ region: args.spec.awsConfig?.region })
    }

    async stackOuputToBoxOutput(o: OutputMap): Promise<ReplicatedEC2InstanceOutputs> {
        const values = await pulumiOutputMapToPlainObject(o)
        const result = ReplicatedEC2InstanceOutputsZ.safeParse(values)
        if(!result.success){
            const err = `Pulumi stack output parse error. Expected ${JSON.stringify(ReplicatedEC2InstanceOutputsZ.shape)}, got ${JSON.stringify(values)}}`
            console.error(err)
            throw new Error(err)
        }
    
        return result.data
    }

    async stop() {
        const o = await this.get()
        const promises = o.replicas.map(r => {
            this.logger.info(`Stopping instance ${r.instanceId}`)
            return this.awsClient.stopInstance(r.instanceId)
        })

        await Promise.all(promises)
        
    }

    async start() {
        const o = await this.get()
        const promises = o.replicas.map(r => {
            this.logger.info(`Starting instance ${r.instanceId}`)
            return this.awsClient.startInstance(r.instanceId)
        })

        await Promise.all(promises)
    }

    async restart() {
        const o = await this.get()
        const promises = o.replicas.map(r => {
            this.logger.info(`Restarting instance ${r.instanceId}`)
            return this.awsClient.rebootInstance(r.instanceId)
        })

        await Promise.all(promises)
    }
    
}