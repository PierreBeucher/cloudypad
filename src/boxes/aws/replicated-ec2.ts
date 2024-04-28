import { z } from 'zod';
import { DnsSchema, InstanceSchema, NetworkSchema, VolumeSchema } from './common.js';
import { BoxMetadata, BoxSchemaBaseZ, MachineBoxProvisioner, MachineBoxProvisionerOutput, MachineBoxProvisionerInstance, MachineBoxProvisionerOutputZ } from '../common/base.js';
import { PulumiManagerBox } from '../pulumi/manager.js';
import { AwsClient } from '../../lib/infra/aws/client.js';
import { ReplicatedEC2instance } from '../../lib/infra/pulumi/components/aws/replicated-ec2.js';
import { OutputMap } from '@pulumi/pulumi/automation/stack.js';
import { pulumiOutputMapToPlainObject } from '../../lib/infra/pulumi/pulumi-client.js';
import * as pulumi from "@pulumi/pulumi"
import { componentLogger, CloudyBoxLogObjI } from "../../lib/logging.js"
import {  Logger } from 'tslog';

export const ReplicatedEC2InstanceManagerBoxSpecZ = z.object({
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
    ignorePublicKeyChanges: z.boolean().optional()
});

export const ReplicatedEC2InstanceSchema = BoxSchemaBaseZ.extend({
    spec: ReplicatedEC2InstanceManagerBoxSpecZ,
})

export type ReplicatedEC2InstanceManagerBoxSpec = z.infer<typeof ReplicatedEC2InstanceManagerBoxSpecZ>

export const BOX_KIND_REPLICATED_EC2_INSTANCE = "aws.ec2.ReplicatedInstance"
export const BOX_CONTEXT_REPLICATED_EC2_INSTANCE = BOX_KIND_REPLICATED_EC2_INSTANCE

export interface ReplicatedEC2InstanceManagerBoxArgs {
    spec: ReplicatedEC2InstanceManagerBoxSpec
}

export class ReplicatedEC2ManagerBox extends PulumiManagerBox<MachineBoxProvisionerOutput> implements MachineBoxProvisioner {
    
    static async parseSpec(source: unknown) : Promise<ReplicatedEC2ManagerBox> {
        const config = ReplicatedEC2InstanceSchema.parse(source)
        return new ReplicatedEC2ManagerBox({name: config.name, context: BOX_CONTEXT_REPLICATED_EC2_INSTANCE}, config)
    }

    readonly awsClient: AwsClient

    readonly logger: Logger<CloudyBoxLogObjI>

    constructor(meta: {name: string, context: string}, args: ReplicatedEC2InstanceManagerBoxArgs) {

        const metadata : BoxMetadata = { name: meta.name, context: meta.context, kind: BOX_KIND_REPLICATED_EC2_INSTANCE }

        const pulumiFn = async ()  => {
            const instances = new ReplicatedEC2instance(`${metadata.context}-${metadata.name}`, args.spec)

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
                meta: metadata
            },
        )
        
        this.logger = componentLogger.getSubLogger({ name: `${metadata.kind}:${metadata.name}` })
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

        // Pulumi may not return proper outputs even after refresh
        // If instance has been stopped or restarted, public IP may be absent or different
        // but it won't affect stack Outputs after refresh
        // as another up is needed to update the stack
        // See https://github.com/pulumi/pulumi/issues/2710
        //
        // Let's retrieve IP specifically for better UX
        for (const instance of result.data.instances){
            const details = await this.awsClient.getInstanceDetails(instance.id)
            instance.address = details.PublicIpAddress
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