import lodash from 'lodash';
const { merge } = lodash;
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { BoxSchemaBaseZ, BoxBase, BoxManager } from "../common/base.js";
import { SSHDefinitionZ } from "../common/virtual-machine.js";
import { z } from "zod";
import { NixOSBoxConfigZ, NixOSBoxConfigurator, NixOSConfigStep } from './configurator.js';
import { SSHCommandOpts } from '../../lib/ssh/client.js';
import { DnsSchema, NetworkSchema } from '../aws/common.js';
import { ReplicatedEC2BoxManager, ReplicatedEC2InstanceBoxManagerSpec, ReplicatedEC2InstanceSchema } from '../aws/replicated-ec2.js';

export const ReplicatedNixOSBoxManagerSpecZ = z.object({
    nixos: NixOSBoxConfigZ,
    ssh: SSHDefinitionZ,
    replicas: z.union([z.array(z.string()), z.number()]),
    dns: DnsSchema.optional(),
    network: NetworkSchema.optional(),
    provider: z.object({
        aws: ReplicatedEC2InstanceSchema.partial()
    })
}).strict()

export const ReplicatedNixOSBoxManagerSchemaZ = BoxSchemaBaseZ.extend({
    spec: ReplicatedNixOSBoxManagerSpecZ
})

export type ReplicatedNixOSBoxManagerSpec = z.infer<typeof ReplicatedNixOSBoxManagerSpecZ>
export type ReplicatedNixOSBoxManagerSchema = z.infer<typeof ReplicatedNixOSBoxManagerSchemaZ>

export interface NixOSBoxManagerArgs {
    spec: ReplicatedNixOSBoxManagerSpec
    provider: ReplicatedEC2BoxManager
    additionalConfigSteps?: NixOSConfigStep[]
}

export const BOX_KIND_LINUX_REPLICATED_NIXOS = "Linux.ReplicatedNixOS.Manager"

/**
 * Manages a cloud VM and NixOS configuration within. 
 */
export class ReplicatedNixOSBoxManager extends BoxBase implements BoxManager {

    static parseSpec = parseReplicatedNixOSBoxManagerSpec

    readonly args: NixOSBoxManagerArgs

    constructor(name: string, args: NixOSBoxManagerArgs, kind = BOX_KIND_LINUX_REPLICATED_NIXOS) {
        super({ name: name, kind: kind})
        this.args = args  
    }

    public async deploy() {
        await this.provision()
        const o = await this.configure()
        return o
    }

    public async provision() {
        const o = await this.args.provider.provision()
        await this.configure()
        return o
    }

    public async configure() {
        const configurators = await this.getConfigurators()
        const configPromises = configurators.map(c => c.configure())
        await Promise.all(configPromises)

        // configurator returns only hostname without knowledge about infra. Use this to get full output
        return this.get() 
    }

    public async destroy(): Promise<void> {
        return this.args.provider.destroy()
    }

    public async preview(): Promise<string> {
        return this.args.provider.preview()
    }

    public async get() {
        return this.args.provider.get()
    }

    public async stop() {
        return this.args.provider.stop()
    }

    public async start() {
        return this.args.provider.start()
    }

    public async restart() {
        return this.args.provider.restart()
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const configurators = await this.getConfigurators()
        const configPromises = configurators.map(c => c.runSshCommand(cmd, opts))
        await Promise.all(configPromises)
    }

    /**
     * Build NixOS configurators for this manager.
     */
    private async getConfigurators(){
        const o = await this.get()
        const configurators = o.replicas.map(r => {
            return new NixOSBoxConfigurator(`${this.metadata.name}-${r.name}`, {
                spec: {
                    ...this.args.spec,
                    hostname: r.ipAddress
                },
                additionalSteps: this.args.additionalConfigSteps
            })
        })
        return configurators
    }

}

export async function parseReplicatedNixOSBoxManagerSpec(rawConfig: unknown) : Promise<ReplicatedNixOSBoxManager> {
    const config = await ReplicatedNixOSBoxManagerSchemaZ.parseAsync(rawConfig)

    // Default configuration for AWS
    const defaultAwsConfig: ReplicatedEC2InstanceBoxManagerSpec = {
        replicas: config.spec.replicas,
        awsConfig: {
            region: "eu-central-1" // TODO default from user environment?
        }, 
        publicKey: await parseSshPrivateKeyToPublic(config.spec.ssh.privateKeyPath),
        dns: config.spec.dns,
        network: merge(
            {
                ingressPorts: [{
                    from: 22
                }]
            }, 
            config.spec.network
        ),
        template: {
            instance: {
                ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
                type: "t3.small",
                rootVolume: {
                    sizeGb: 16 // NixOS needs generous amount of disk by default
                }
            },
        }
        
    }
    const finalAwsConfig = merge(defaultAwsConfig, config.spec.provider.aws)

    const awsBoxManager = new ReplicatedEC2BoxManager(`nixos-${config.name}`, finalAwsConfig)

    return new ReplicatedNixOSBoxManager(config.name, {
        provider: awsBoxManager,
        spec: config.spec
    })
}

