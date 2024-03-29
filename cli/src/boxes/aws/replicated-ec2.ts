import { z } from 'zod';
import { DnsSchema, InstanceSchema, NetworkSchema, VolumeSchema } from './common.js';
import { BoxSchemaBaseZ } from '../common/base.js';
import { PulumiBoxManager } from '../pulumi/manager.js';
import { AwsClient } from '../../lib/infra/aws/client.js';
import { ReplicatedEC2instance } from '../../lib/infra/pulumi/components/aws/replicated-ec2.js';
import { OutputMap } from '@pulumi/pulumi/automation/stack.js';
import { pulumiOutputMapToPlainObject } from '../../lib/infra/pulumi/pulumi-client.js';
import { CompositeEC2InstanceOutputs, CompositeEC2InstanceOutputsZ } from './composite-ec2.js';
import * as pulumi from "@pulumi/pulumi"
import * as logging from "../../lib/logging.js"

export const ReplicatedEC2InstanceArgsZ = z.object({
    awsConfig: z.object({ // TODO need a better way to handle that
        region: z.string()
    }),
    publicKey: z.string(),
    network: NetworkSchema,
    dns: DnsSchema.optional(),
    tags: z.record(z.string()).optional(),
    replicas: z.union([z.array(z.string()), z.number()]),
    template: z.object({
        instance: InstanceSchema,
        volumes: z.array(VolumeSchema).optional(),
    }),
});

export type ReplicatedEC2InstanceArgs = z.infer<typeof ReplicatedEC2InstanceArgsZ>

export const ReplicatedEC2InstanceSchema = BoxSchemaBaseZ.extend({
    spec: ReplicatedEC2InstanceArgsZ,
})

export const ReplicatedEC2InstanceOutputsZ = z.object({
    replicas: z.array(CompositeEC2InstanceOutputsZ)
})

export type ReplicatedEC2InstanceOutputs = z.infer<typeof ReplicatedEC2InstanceOutputsZ>


export const BOX_KIND_REPLICATED_EC2_INSTANCE = "aws.ec2.ReplicatedInstance"

export class ReplicatedEC2BoxManager extends PulumiBoxManager<ReplicatedEC2InstanceOutputs> {
    
    static async parseSpec(source: unknown) : Promise<ReplicatedEC2BoxManager> {
        const config = ReplicatedEC2InstanceSchema.parse(source)
        return new ReplicatedEC2BoxManager(config.name, config.spec)
    }

    readonly awsClient: AwsClient

    constructor(name: string, spec: ReplicatedEC2InstanceArgs) {

        const pulumiFn = async ()  => {
            const instances = new ReplicatedEC2instance(name, spec)

            const replicas = instances.replicas.map(r => pulumi.all([ 
                    r.instanceVolumesEIP.instance.id,
                    r.instanceVolumesEIP.publicIp,
                    r.fqdn
                ]).apply(([instanceId, ip, fqdn]) : CompositeEC2InstanceOutputs => {
                    return {
                        ipAddress: ip,
                        instanceId: instanceId,
                        fqdn: fqdn
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
                    "aws:region": { value: spec.awsConfig.region }
                },
                meta: { name: name, kind: BOX_KIND_REPLICATED_EC2_INSTANCE }
            },
        )

        this.awsClient = new AwsClient({ region: spec.awsConfig?.region })
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
            logging.ephemeralInfo(`Stopping instance ${r.instanceId}`)
            return this.awsClient.stopInstance(r.instanceId)
        })

        await Promise.all(promises)
        
    }

    async start() {
        const o = await this.get()
        const promises = o.replicas.map(r => {
            logging.ephemeralInfo(`Starting instance ${r.instanceId}`)
            return this.awsClient.startInstance(r.instanceId)
        })

        await Promise.all(promises)
    }

    async restart() {
        const o = await this.get()
        const promises = o.replicas.map(r => {
            logging.ephemeralInfo(`Restarting instance ${r.instanceId}`)
            return this.awsClient.rebootInstance(r.instanceId)
        })

        await Promise.all(promises)
    }
    
}