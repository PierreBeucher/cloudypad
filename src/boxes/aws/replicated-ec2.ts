import { z } from 'zod';
import { DnsSchema, InstanceSchema, NetworkSchema, VolumeSchema } from './common.js';
import { BoxMetadata, BoxSchemaBaseZ, MachineBoxProvisioner, MachineBoxProvisionerOutput, MachineBoxProvisionerInstance, MachineBoxProvisionerOutputZ } from '../common/base.js';
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

export type ReplicatedEC2InstanceBoxManagerSpec = z.infer<typeof ReplicatedEC2InstanceBoxManagerSpecZ>

export const BOX_KIND_REPLICATED_EC2_INSTANCE = "aws.ec2.ReplicatedInstance"

export interface ReplicatedEC2InstanceBoxManagerArgs {
    spec: ReplicatedEC2InstanceBoxManagerSpec
}

export class ReplicatedEC2BoxManager extends PulumiBoxManager<MachineBoxProvisionerOutput> implements MachineBoxProvisioner {
    
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
                    r.name,
                ]).apply(([instanceId, ip, name]) : MachineBoxProvisionerInstance => {
                    return {
                        address: ip,
                        id: instanceId,
                        name: name
                    }
                })
            )

            return pulumi.all(replicas).apply( (reps) : MachineBoxProvisionerOutput => {
                return {
                    instances: reps
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

    async stackOuputToBoxOutput(o: OutputMap): Promise<MachineBoxProvisionerOutput> {
        const values = await pulumiOutputMapToPlainObject(o)
        const result = MachineBoxProvisionerOutputZ.safeParse(values)
        if(!result.success){
            const err = `Pulumi stack output parse error. Expected ${JSON.stringify(MachineBoxProvisionerOutputZ.shape)}, got ${JSON.stringify(values)}}`
            console.error(err)
            throw new Error(err)
        }
    
        return result.data
    }

    async stop() {
        const o = await this.get()
        const promises = o.instances.map(r => {
            this.logger.info(`Stopping instance ${r.id}`)
            return this.awsClient.stopInstance(r.id)
        })

        await Promise.all(promises)
        
    }

    async start() {
        const o = await this.get()
        const promises = o.instances.map(r => {
            this.logger.info(`Starting instance ${r.id}`)
            return this.awsClient.startInstance(r.id)
        })

        await Promise.all(promises)
    }

    async restart() {
        const o = await this.get()
        const promises = o.instances.map(r => {
            this.logger.info(`Restarting instance ${r.id}`)
            return this.awsClient.rebootInstance(r.id)
        })

        await Promise.all(promises)
    }
    
}