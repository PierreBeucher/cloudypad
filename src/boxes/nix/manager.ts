import lodash from 'lodash';
const { merge } = lodash;
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { BoxSchemaBaseZ, BoxBase, BoxManager } from "../common/base.js";
import { SSHDefinitionZ } from "../common/virtual-machine.js";
import { z } from "zod";
import { NixOSBoxConfig, NixOSBoxConfigZ, NixOSBoxConfigurator, NixOSBoxConfiguratorSpec, NixOSConfigStep } from './configurator.js';
import { SSHCommandOpts } from '../../lib/ssh/client.js';
import { DnsSchema, NetworkSchema } from '../aws/common.js';
import { ReplicatedEC2BoxManager, ReplicatedEC2InstanceBoxManagerArgs, ReplicatedEC2InstanceOutput, ReplicatedEC2InstanceSchema } from '../aws/replicated-ec2.js';
import { SSHExecCommandResponse } from 'node-ssh';

export const ReplicatedNixOSBoxManagerSpecZ = z.object({
    nixos: NixOSBoxConfigZ.partial().optional(),
    ssh: SSHDefinitionZ,
    replicas: z.union([z.array(z.string()), z.number()]).optional(),
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

export interface ReplicatedNixOSBoxManagerArgs {
    spec: ReplicatedNixOSBoxManagerSpec
    provider: ReplicatedEC2BoxManager
    additionalConfigSteps?: NixOSConfigStep[]
}

export const BOX_KIND_LINUX_REPLICATED_NIXOS = "Linux.NixOS.Manager"

const DEFAULT_NIXOS_CONFIG : NixOSBoxConfig = {
    nixosChannel: "nixos-23.05",
    homeManagerRelease: "release-23.05",
    nixosConfigName: "aws-base"
}

/**
 * Manages a cloud VM and NixOS configuration within. 
 */
export class ReplicatedNixOSBoxManager extends BoxBase implements BoxManager {

    static parseSpec = parseReplicatedNixOSBoxManagerSpec

    readonly args: ReplicatedNixOSBoxManagerArgs

    constructor(name: string, args: ReplicatedNixOSBoxManagerArgs, kind = BOX_KIND_LINUX_REPLICATED_NIXOS) {
        super({ name: name, kind: kind})
        this.args = args  
    }

    public async deploy() {
        await this.provision()
        const o = await this.configure()
        return o
    }

    public async provision() {
        return this.args.provider.provision()
    }

    public async configure() {
        const configurators = await this.getConfigurators()
        const configPromises = Array.from(configurators.values()).map(c => c.configurator.configure())
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

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts): Promise<{ replica: ReplicatedEC2InstanceOutput, sshRes: SSHExecCommandResponse }[]> {
        const configurators = await this.getConfigurators()

        const result = configurators.map(async c => {
            const sshRes = await c.configurator.runSshCommand(cmd, opts)
            return { replica: c.replica, sshRes: sshRes }
        })

        return Promise.all(result)
    }

    /**
     * Build NixOS configurators for this manager's replicas
     */
    private async getConfigurators() : Promise<{ replica: ReplicatedEC2InstanceOutput, configurator: NixOSBoxConfigurator }[]> {
        const o = await this.get()
        
        const result = o.replicas.map(r => {
            const configuratorSpec : NixOSBoxConfiguratorSpec = merge({
                hostname: r.publicIp,
                nixos: DEFAULT_NIXOS_CONFIG,
            }, this.args.spec)

            return {
                replica: r,
                configurator: new NixOSBoxConfigurator(`${this.metadata.name}-${r.name}`, {
                    spec: configuratorSpec,
                    additionalSteps: this.args.additionalConfigSteps
                })
            }
        })

        return result
    }

}

export async function parseReplicatedNixOSBoxManagerSpec(rawConfig: unknown) : Promise<ReplicatedNixOSBoxManager> {
    const config = await ReplicatedNixOSBoxManagerSchemaZ.parseAsync(rawConfig)

    // Default configuration for AWS
    const defaultAwsConfig: ReplicatedEC2InstanceBoxManagerArgs = {
        spec: {
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

