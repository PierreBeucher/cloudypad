import lodash from 'lodash';
const { merge } = lodash;
import { BoxSchemaBaseZ, BoxBase, BoxManager, MachineBoxProvisioner, MachineBoxProvisionerInstanceWithAddress } from "../common/base.js";
import { SSHDefinitionZ } from "../common/virtual-machine.js";
import { z } from "zod";
import { NixOSConfigurator, NixOSConfiguratorArgs } from './configurator.js';
import { SSHCommandOpts } from '../../lib/ssh/client.js';
import { DnsSchema, NetworkSchema } from '../aws/common.js';
import { ReplicatedEC2BoxManager, ReplicatedEC2InstanceBoxManagerArgs, ReplicatedEC2InstanceBoxManagerSpecZ } from '../aws/replicated-ec2.js';
import { SSHExecCommandResponse } from 'node-ssh';
import { PaperspaceBoxManager, PaperspaceBoxManagerSpecZ } from '../paperspace/manager.js';
import { mainLogger } from '../../lib/logging.js';
import { nixOSInfect } from './configurator-steps.js';
import { getUserSSHPublicKey } from '../../lib/ssh/utils.js';
import { NixOSModule, NixOSModuleDirectory } from '../../lib/nix/interfaces.js';
import { authorizedKeys } from '../../lib/nix/modules/authorized-keys.nix.js';
import { awsBase } from '../../lib/nix/modules/aws-base.nix.js';
import * as path from 'path';

export const NixOSBoxConfigZ = z.object({
    nixosChannel: z.string(),
    homeManagerRelease: z.optional(z.string()),
    modules: z.array(z.object({
        path: z.string(),
    })).optional(),
    modulesDir: z.array(z.object({
        path: z.string(),
    })).optional()
}).strict()

export const ReplicatedNixOSBoxManagerSpecZ = z.object({
    nixos: NixOSBoxConfigZ.partial().optional(),
    ssh: SSHDefinitionZ,
    replicas: z.union([z.array(z.string()), z.number()]).optional(),
    dns: DnsSchema.optional(),
    network: NetworkSchema.optional(),
    provisioner: z.object({
        aws: ReplicatedEC2InstanceBoxManagerSpecZ.deepPartial().optional(),
        paperspace: PaperspaceBoxManagerSpecZ.deepPartial().optional()
    }),

}).strict()

export const ReplicatedNixOSBoxManagerSchemaZ = BoxSchemaBaseZ.extend({
    spec: ReplicatedNixOSBoxManagerSpecZ
})

export type ReplicatedNixOSBoxManagerSpec = z.infer<typeof ReplicatedNixOSBoxManagerSpecZ>
export type ReplicatedNixOSBoxManagerSchema = z.infer<typeof ReplicatedNixOSBoxManagerSchemaZ>
export type NixOSBoxConfig = z.infer<typeof NixOSBoxConfigZ>

export interface ReplicatedNixOSBoxManagerArgs {

    /**
     * Raw spec defined by users
     */
    spec: ReplicatedNixOSBoxManagerSpec

    /**
     * Provisioner to manage infrastructure
     */
    provisioner: MachineBoxProvisioner

    /**
     * Underlying NixOSConfigurator(s) arguments
     */
    configuratorOverrides?: Partial<NixOSConfiguratorArgs>
}

export const BOX_KIND_LINUX_REPLICATED_NIXOS = "Linux.NixOS.Manager"

const DEFAULT_NIXOS_CONFIG = {
    nixosChannel: "nixos-23.11",
    homeManagerRelease: "release-23.11",
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
        return this.args.provisioner.provision()
    }

    public async configure() {
        const configurators = await this.buildConfigurators()
        const configPromises = Array.from(configurators.values()).map(c => c.configurator.configure())
        await Promise.all(configPromises)

        // configurator returns only hostname without knowledge about infra. Use this to get full output
        return this.get() 
    }

    public async destroy(): Promise<void> {
        return this.args.provisioner.destroy()
    }

    public async refresh() {
        return this.args.provisioner.refresh()
    }

    public async preview(): Promise<string> {
        return this.args.provisioner.preview()
    }

    public async get() {
        return this.args.provisioner.get()
    }

    public async stop() {
        return this.args.provisioner.stop()
    }

    public async start() {
        return this.args.provisioner.start()
    }

    public async restart() {
        return this.args.provisioner.restart()
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts): Promise<{ replica: MachineBoxProvisionerInstanceWithAddress, sshRes: SSHExecCommandResponse }[]> {
        const configurators = await this.buildConfigurators()

        const result = configurators.map(async c => {
            const sshRes = await c.configurator.runSshCommand(cmd, opts)
            return { replica: c.replica, sshRes: sshRes }
        })

        return Promise.all(result)
    }

    /**
     * Build NixOS configurators for this manager's replicas
     */
    private async buildConfigurators() : Promise<{ replica: MachineBoxProvisionerInstanceWithAddress, configurator: NixOSConfigurator }[]> {
        const o = await this.get()
        
        const result: { replica: MachineBoxProvisionerInstanceWithAddress, configurator: NixOSConfigurator }[] = o.instances.map(r => {
            if (!r.address) {
                throw new Error(`Couldn't get address for instance ${r.name} (${r.id}). Maybe it's not started?`)
            }

            const configuratorArgs: NixOSConfiguratorArgs = lodash.merge({
                homeManagerRelease: this.args.spec.nixos?.homeManagerRelease || DEFAULT_NIXOS_CONFIG.homeManagerRelease,
                nixosChannel: this.args.spec.nixos?.nixosChannel || DEFAULT_NIXOS_CONFIG.nixosChannel,
                hostname: r.address,
                ssh: this.args.spec.ssh,
            }, this.args.configuratorOverrides)

            return {
                replica: {
                    address: r.address,
                    id: r.id,
                    name: r.name
                },
                configurator: new NixOSConfigurator(`${this.metadata.name}`, configuratorArgs)
            }
        })

        return result
    }

}

export async function parseReplicatedNixOSBoxManagerSpec(rawConfig: unknown) : Promise<ReplicatedNixOSBoxManager> {

    const parsedConfig = ReplicatedNixOSBoxManagerSchemaZ.safeParse(rawConfig)
    if (!parsedConfig.success) {
        throw new Error(`Config parse errors: ${JSON.stringify(parsedConfig.error.issues, undefined, 2)}`)
    }

    const config = parsedConfig.data

    // Multiple providers can be used but exactly one must be set
    // TODO Unit test !
    const provKeys = Object.keys(config.spec.provisioner)

    mainLogger.info(`Found provisioner(s): ${JSON.stringify(provKeys)}`)
    if (provKeys.length != 1) {
        throw new Error(`Exactly a single provisioner must be set. Got: ${provKeys}`)
    }

    const provisionerName = provKeys[0]

    // Find or generate the public SSH key to provision instance in this order:
    // - If private key is provided, use it 
    // - Otherwise, find first available private key
    // Then generate a public key out of it
    const sshPubKey = await getUserSSHPublicKey(config.spec.ssh.privateKeyPath)

    //
    // Build NixOS configuration from spec
    //
    const modules: NixOSModule[] = []
    const modulesDir: NixOSModuleDirectory[] = []

    if(config.spec.ssh.authorizedKeys) {
        const akm = authorizedKeys("root", config.spec.ssh.authorizedKeys)
        modules.push(akm)
    }

    for (const m of config.spec.nixos?.modules || []){
        modules.push({
            name: path.basename(m.path),
            path: m.path
        })
    }

    for (const md of config.spec.nixos?.modulesDir || []){
        modulesDir.push({
            name: path.basename(md.path),
            path: md.path
        })
    }

    const configuratorOverrides : Partial<NixOSConfiguratorArgs> = {
        modulesDirs: modulesDir,
        modules: modules
    }

    switch (provisionerName) {
        case "aws": {

            // Default configuration for AWS
            const defaultAwsConfig: ReplicatedEC2InstanceBoxManagerArgs = {
                spec: {
                    replicas: config.spec.replicas,
                    awsConfig: {
                        region: "eu-central-1" // TODO default from user environment?
                    },
                    publicKey: sshPubKey,
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
                    // Once an instance is prosivioned with a public key any change would cause instance to be recreated
                    // Instead ignore changes to keep instance, letting user change authorized keys instead
                    ignorePublicKeyChanges: true
                }
            }


            // Provisioner
            const finalAwsConfig: ReplicatedEC2InstanceBoxManagerArgs = merge(defaultAwsConfig, {
                spec: config.spec.provisioner.aws
            })

            mainLogger.info(`AWS config: ${JSON.stringify(finalAwsConfig, undefined, 2)}`)

            const awsBoxManager = new ReplicatedEC2BoxManager(`nixos-${config.name}`, finalAwsConfig)

            // Specific modules for AWS
            modules.push(awsBase())

            return new ReplicatedNixOSBoxManager(config.name, {
                provisioner: awsBoxManager,
                configuratorOverrides: configuratorOverrides,
                spec: config.spec,
            })
        }
        case "paperspace": {
            const ppProvisionerSpec = config.spec.provisioner.paperspace!
            
            const ppBoxManager = new PaperspaceBoxManager(`nixos-${config.name}`, {
                apiKeyFile: ppProvisionerSpec.apiKeyFile,
                machineType: ppProvisionerSpec.machineType || "C2",
                region: ppProvisionerSpec.region || "Europe (AMS1)"
            })

            return new ReplicatedNixOSBoxManager(config.name, {
                provisioner: ppBoxManager,
                spec: config.spec,
                configuratorOverrides: lodash.merge(configuratorOverrides, {
                    // Paperspace does not provide NixOS image... Let's infect !
                    additionalPreConfigSteps: [nixOSInfect]
                })
            })
        }
        default:
            throw new Error(`Provisioner not implemented: ${provisionerName}`)
    }
    
    
}

