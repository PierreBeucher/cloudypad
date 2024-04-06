import { SSHClient, SSHCommandOpts } from "../../lib/ssh/client.js";
import { BoxSchemaBaseZ, BoxBase, BoxConfigurator } from "../common/base.js";
import { SSHDefinitionZ } from "../common/virtual-machine.js";
import { z } from "zod";
import * as utils from "../../utils.js"

export const NixOSBoxConfigZ = z.object({
    nixosConfigName: z.string(),
    nixosChannel: z.string(),
    homeManagerRelease: z.optional(z.string())
}).strict()

export const NixOSBoxConfiguratorSpecZ = z.object({
    nixos: NixOSBoxConfigZ,
    ssh: SSHDefinitionZ,
    hostname: z.string()
}).strict()

export const NixOSBoxConfiguratorSchemaZ = BoxSchemaBaseZ.extend({
    spec: NixOSBoxConfiguratorSpecZ
})

export type NixOSBoxConfiguratorSpec = z.infer<typeof NixOSBoxConfiguratorSpecZ>
export type NixOSBoxConfiguratorSchema = z.infer<typeof NixOSBoxConfiguratorSchemaZ>
export type NixOSBoxConfig = z.infer<typeof NixOSBoxConfigZ>

export interface NixOSBoxConfiguratorArgs {
    spec: NixOSBoxConfiguratorSpec
    additionalSteps?: NixOSConfigStep[]
}

export const NIXOS_BOX_CONFIGURATOR_KIND = "Linux.NixOS.Configurator"

export declare type NixOSConfigStep = (ssh: SSHClient) => Promise<void>;

/**
 * Manages an existing NixOS machine through SSH. 
 * 
 * NixOS configuration is done through modular steps. By default it will only copy configuration.nix and
 * run nixos-rebuild switch, but installation procedure can be customized with NixOSConfigStep.
 * 
 * Internal array configSteps[] represents the configurations steps. By default a single step exists
 * for nixos-rebuild, but you can customize it such as:
 * 
 * ```typescript
 * const steps = bm.getConfigSteps()
 * steps.push(async (ssh: SSHClient) => {
 *      await this.doSomething(ssh)
 * })
 * ```
 */
export class NixOSBoxConfigurator extends BoxBase implements BoxConfigurator {

    readonly args: NixOSBoxConfiguratorArgs

    private configSteps: NixOSConfigStep[]

    constructor(name: string, args: NixOSBoxConfiguratorArgs) {
        super({ name: name, kind: NIXOS_BOX_CONFIGURATOR_KIND})
        this.args = args
        this.configSteps = [
            async (ssh: SSHClient) => { 
                await this.ensureNixChannel(ssh, this.args.spec.nixos.nixosChannel, this.args.spec.nixos.homeManagerRelease)
                await this.ensureNixosConfig(ssh, this.args.spec.nixos.nixosConfigName)
            }
        ]
        this.configSteps.push(...args.additionalSteps || [])
    }

    /**
     * Run each config step in order 
     */
    private async doConfigure(){
        const ssh = this.buildSshClient()
        try {
            await this.doWaitForSshConnection(ssh)
            for (const step of this.configSteps){
                await step(ssh)
            }
        } finally {
            ssh.dispose()
        }
    }

    public async configure() {
        const o = await this.get()

        this.logger.info(`   Configuring NixOS instance ${this.metadata.name}`)
        await this.doConfigure()
        this.logger.info(`   NixOS instance ${this.metadata.name} provisioned !`)

        return o
    }

    public async get() {
        return { 
            hostname: this.args.spec.hostname 
        }
    }

    async stop() {
        throw new Error("Method not implemented.");
    }

    async start() {
        throw new Error("Method not implemented.");
    }

    async restart() {
        throw new Error("Method not implemented.");
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const ssh = this.buildSshClient()
        try {
            await ssh.connect()
            return await this.doRunSshCommand(ssh, cmd, opts)
        } finally {
            ssh.dispose()
        }
        
    }

    public async getConfigSteps(){
        return this.configSteps
    }

    public async waitForSsh(){
        const ssh = this.buildSshClient()
        try {
            await ssh.connect()
            await this.doWaitForSshConnection(ssh)
        } finally {
            ssh.dispose()
        }
    }

    private async doWaitForSshConnection(ssh: SSHClient){
        return ssh.waitForConnection()
    }

    private async doRunSshCommand(ssh: SSHClient, cmd: string[], opts?: SSHCommandOpts){
        return ssh.command(cmd, opts)
    }

    /**
     * Ensure NixOS instance channels are set
     */
    private async ensureNixChannel(ssh: SSHClient, nixosChannel: string, homeManagerRelease?: string){            
        await ssh.command([`nix-channel`, "--add", `https://nixos.org/channels/${nixosChannel}`, "nixos"])

        if (homeManagerRelease){
            await ssh.command(["nix-channel", "--add", `https://github.com/nix-community/home-manager/archive/${homeManagerRelease}.tar.gz`, "home-manager"])
        }

        await ssh.command(["nix-channel", "--update"])
    }

    /**
     * Copy NixOS configuration and run nixos-rebuild --switch
     */
    private async ensureNixosConfig(ssh: SSHClient, nixosConfigName: string){

        this.logger.info("  Rebuilding NixOS config...")

        const configFile = utils.joinSafe(utils.NIX_CONFIGS_DIR, `${nixosConfigName}.nix`)

        this.logger.info("  Copying NixOS configuration...")
        await ssh.putDirectory(utils.NIX_CONFIGS_DIR, '/etc/nixos/')
        await ssh.putFile(configFile, "/etc/nixos/configuration.nix",)
        
        this.logger.info("  Rebuilding NixOS configuration...")
        await ssh.command(["nixos-rebuild", "switch", "--upgrade"] )
    }

    private buildSshClient(){
        return new SSHClient({
            clientName: `${this.metadata.kind}:${this.metadata.name}:ssh`,
            host: this.args.spec.hostname,
            user: this.args.spec.ssh.user || "root",
            sshKeyPath: this.args.spec.ssh.privateKeyPath
        })
    }
}