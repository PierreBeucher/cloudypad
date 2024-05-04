import lodash from 'lodash';
const { merge } = lodash;
import { BoxSchemaBaseZ as ProjectSchemaBaseZ, BaseBox as BaseBox, ManagerBox as ManagerBox, MachineBoxProvisioner as MachineProvisionerBox, BoxConstructorMetadata, buildMainBoxMeta } from "../common/base.js";
import { SSHDefinitionZ } from "../common/virtual-machine.js";
import { z } from "zod";
import { NixOSConfigStep, NixOSConfigurator, NixOSConfiguratorArgs, NixOSPreConfigStep } from '../../lib/nix/configurator.js';
import { SSHCommandOpts } from '../../lib/ssh/client.js';
import { DnsSchema, NetworkSchema } from '../aws/common.js';
import { ReplicatedEC2ManagerBox, ReplicatedEC2InstanceManagerBoxArgs, ReplicatedEC2InstanceProjectSpecZ } from '../aws/replicated-ec2.js';
import { SSHExecCommandResponse } from 'node-ssh';
import { PaperspaceManagerBox, PaperspaceProjectSpecZ } from '../paperspace/manager.js';
import { mainLogger } from '../../lib/logging.js';
import { getUserSSHPublicKey } from '../../lib/ssh/utils.js';
import { NixOSModule } from '../../lib/nix/modules.js';
import { authorizedKeys } from '../../lib/nix/module-templates/authorized-keys.nix.js';
import { awsBase } from '../../lib/nix/module-templates/aws-base.nix.js';
import { NixOSFleetConfigurator, NixOSInstance } from '../../lib/nix/fleet-configurator.js';
import { nixOSInfect } from '../../lib/nix/configurator-steps.js';
import { parseProvisionerName } from '../common/provisioners.js';

export const NixOSBoxConfigZ = z.object({
    nixosChannel: z.string(),
    homeManagerRelease: z.optional(z.string()),
    modules: z.array(z.object({
        name: z.string().optional(),
        path: z.string(),
        skipImport: z.boolean().optional().describe("Do not import module in main NixOS configuration. Module's files will be copied on target host without being referenced directly in NixOS config.")
    })).optional().describe("NixOS modules to import in NixOS flake.nix configuration. Can be a file or directory. Will be added directly as import [ ./xxx ] of flake.nix used for NixOS configuration."),
}).strict()

export const NixOSProjectSpecZ = z.object({
    nixos: NixOSBoxConfigZ.partial().optional(),
    ssh: SSHDefinitionZ,
    replicas: z.union([z.array(z.string()), z.number()]).optional(),
    dns: DnsSchema.optional(),
    network: NetworkSchema.optional(),
    provisioner: z.object({
        aws: ReplicatedEC2InstanceProjectSpecZ.deepPartial().optional(),
        paperspace: PaperspaceProjectSpecZ.deepPartial().optional()
    }),

}).strict()

export const NixOSProjectSchemaZ = ProjectSchemaBaseZ.extend({
    spec: NixOSProjectSpecZ
})

export type NixOSProjectSpec = z.infer<typeof NixOSProjectSpecZ>
export type NixOSProjecSchema = z.infer<typeof NixOSProjectSchemaZ>
export type NixOSBoxConfig = z.infer<typeof NixOSBoxConfigZ>

export interface NixOSManagerBoxArgs {
    /**
     * Provisioner to manage infrastructure
     */
    provisioner: MachineProvisionerBox

    /**
     * Configurator args to manage each NixOS instances
     */
    nixosConfiguratorArgs: NixOSConfiguratorArgs
}

export const PROJECT_KIND_LINUX_REPLICATED_NIXOS = "Linux.NixOS"

const DEFAULT_NIXOS_CONFIG = {
    nixosChannel: "nixos-23.11",
    homeManagerRelease: "release-23.11",
}

/**
 * Manages a cloud VM and NixOS configuration within. 
 */
export class NixOSManagerBox extends BaseBox implements ManagerBox {

    static parseSpec = parseNixOSManagerBoxSpec

    readonly args: NixOSManagerBoxArgs

    constructor(meta: BoxConstructorMetadata, args: NixOSManagerBoxArgs) {
        super({ name: meta.name, project: meta.project, type: PROJECT_KIND_LINUX_REPLICATED_NIXOS})
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
        const manager = await this.getInstanceManager()
        await manager.configure()
        return this.get() // Probably don't need a second get() call - use configure output ? Or no return at all ?
    }

    public async destroy() {
        return this.args.provisioner.destroy()
    }

    public async refresh() {
        return this.args.provisioner.refresh()
    }

    public async preview() {
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

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts): Promise<{ configurator: NixOSConfigurator, sshRes: SSHExecCommandResponse }[]> {
        const manager = await this.getInstanceManager()
        return manager.runSshCommand(cmd, opts)
    }

    private async getInstanceManager() : Promise<NixOSFleetConfigurator> {
        const outputs = await this.get()
        
        const instances = outputs.instances.map((i): NixOSInstance => {
            if (!i.address) {
                this.logger.error(`No address found on instance ${i.name} (${i.id})`)
                throw new Error(`No address found on instance ${i.name} (${i.id}). Maybe it's not started yet?`)
            }

            return {
                hostname: i.address
            }
        })

        return new NixOSFleetConfigurator({ 
            configuratorArgs: this.args.nixosConfiguratorArgs,
            instances: instances,
            name: this.metadata.name
        })
        
    }

}

export interface NixOSManagerBoxBuilderArgs {
    readonly spec: NixOSProjectSpec
    readonly additionalPreConfigSteps?: NixOSPreConfigStep[]
    readonly additionalConfigSteps?: NixOSConfigStep[]
}

export class NixOSManagerBoxBuilder {
    
    readonly args: NixOSManagerBoxBuilderArgs

    constructor(args: NixOSManagerBoxBuilderArgs){
        this.args = args
    }
    
    async buildProvisioner(meta: BoxConstructorMetadata) : Promise<MachineProvisionerBox>{

        const provisionerName = parseProvisionerName(this.args.spec.provisioner)
    
        // Find or generate the public SSH key to provision instance in this order:
        // - If private key is provided, use it 
        // - Otherwise, find first available private key
        // Then generate a public key out of it
        const sshPubKey = await getUserSSHPublicKey(this.args.spec.ssh.privateKeyPath)
        
        switch (provisionerName) {
            case "aws": {
    
                // Default configuration for AWS
                const defaultAwsConfig: ReplicatedEC2InstanceManagerBoxArgs = {
                    spec: {
                        replicas: this.args.spec.replicas,
                        awsConfig: {
                            region: "eu-central-1" // TODO default from user environment?
                        },
                        publicKey: sshPubKey,
                        dns: this.args.spec.dns,
                        network: merge( // Always open port 22 for SSH (TODO add an option to change it)
                            {
                                ingressPorts: [{
                                    from: 22
                                }]
                            }, 
                            this.args.spec.network
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
                const finalAwsConfig: ReplicatedEC2InstanceManagerBoxArgs = merge(defaultAwsConfig, {
                    spec: this.args.spec.provisioner.aws
                })
    
                mainLogger.debug(`AWS config: ${JSON.stringify(finalAwsConfig, undefined, 2)}`)
    
                return new ReplicatedEC2ManagerBox(meta, finalAwsConfig)
    
            }
            case "paperspace": {
                const ppProvisionerSpec = this.args.spec.provisioner.paperspace!
                
                return new PaperspaceManagerBox(meta, {
                    apiKeyFile: ppProvisionerSpec.apiKeyFile,
                    machineType: ppProvisionerSpec.machineType || "C2",
                    region: ppProvisionerSpec.region || "Europe (AMS1)"
                })
            }
        }
        
        throw new Error(`Provisioner not implemented: ${provisionerName}`)
    }
    
    async buildConfiguratorArgs() : Promise<NixOSConfiguratorArgs>{
       
        const provisionerName = parseProvisionerName(this.args.spec.provisioner)
    
        const modules: NixOSModule[] = []
    
        if(this.args.spec.ssh.authorizedKeys) {
            const akm = authorizedKeys("root", this.args.spec.ssh.authorizedKeys)
            modules.push(akm)
        }
    
        for (const m of this.args.spec.nixos?.modules || []){
            modules.push({
                sourcePath: m.path,
                name: m.name,
                skipImport: m.skipImport
            })
        }
    
        const configuratorArgs : NixOSConfiguratorArgs = {
            nixosChannel: DEFAULT_NIXOS_CONFIG.nixosChannel,
            homeManagerRelease: DEFAULT_NIXOS_CONFIG.homeManagerRelease,
            modules: modules,
            additionalConfigSteps: this.args.additionalConfigSteps || [],
            additionalPreConfigSteps: this.args.additionalPreConfigSteps || [],
            ssh: {
                port: this.args.spec.ssh.port,
                user: this.args.spec.ssh.user,
                privateKeyPath: this.args.spec.ssh.privateKeyPath,
            },
        }
    
        switch (provisionerName) {
            case "aws": {
                configuratorArgs.modules.push(awsBase())
                break
            }
            case "paperspace": {
                // Paperspace does not provide native NixOS image
                // Infect it !
                configuratorArgs.additionalPreConfigSteps.push(nixOSInfect)
                break
            }
        }

        return configuratorArgs
    }

    async buildManagerBox(meta: BoxConstructorMetadata): Promise<NixOSManagerBox> {
        const provisioner = await this.buildProvisioner(meta)
        const nixosConfiguratorArgs = await this.buildConfiguratorArgs()
        return new NixOSManagerBox(meta, {
            provisioner: provisioner,
            nixosConfiguratorArgs: nixosConfiguratorArgs
        })
    }
}

export async function parseNixOSManagerBoxSpec(rawConfig: unknown) : Promise<NixOSManagerBox> {

    const parsedConfig = NixOSProjectSchemaZ.safeParse(rawConfig)
    if (!parsedConfig.success) {
        throw new Error(`Config parse errors: ${JSON.stringify(parsedConfig.error.issues, undefined, 2)}`)
    }

    return new NixOSManagerBoxBuilder({ spec: parsedConfig.data.spec }).buildManagerBox(buildMainBoxMeta(parsedConfig.data))
}

