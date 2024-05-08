import { SSHClient, SSHCommandOpts } from "../ssh/client.js";
import { NixOSFlakeBuilder, NixOSModule } from "./modules.js";
import { Logger } from "tslog";
import { CloudyBoxLogObjI, componentLogger } from "../logging.js";
import { NixOSInstance } from "./fleet-configurator.js";

export interface NixOSConfiguratorArgs {

    /**
     * SSH config to access instance, overriding discovered system config.
     */
    ssh: {
        user?: string,
        port?: number,
        privateKeyPath?: string
    }

    /**
     * NixOS channel to use, eg. "nixos-23.11"
     */
    nixosChannel: string

    /**
     * Home manager release to install, eg. "release-23.11"
     */
    homeManagerRelease: string

    /**
     * Module to use as configuration.nix
     */
    modules: NixOSModule[]

    /**
     * Install steps run before initial SSH connection to run NixOS rebuild..
     */
    additionalPreConfigSteps: NixOSPreConfigStep[]

    /**
     * Install steps run after NixOS rebuild.
     */
    additionalConfigSteps: NixOSConfigStep[]
}

export const NIXOS_BOX_CONFIGURATOR_KIND = "Linux.NixOS.Configurator"

export declare type NixOSPreConfigStep = (box: NixOSConfigurator) => Promise<void>;
export declare type NixOSConfigStep = (box: NixOSConfigurator, ssh: SSHClient) => Promise<void>;

/**
 * Manages an existing NixOS machine through SSH. 
 * 
 * NixOS configuration is done through modular steps. By default it will only copy configuration.nix and
 * run nixos-rebuild switch, but installation steps can be customized:
 * - preConfigSteps are run before SSH connection attempt to run NixOS config. 
 *   It can be used to prepare the machine, eg. run nixos-infect.
 * - additionalConfigSteps are run after configuration of NixOS (nixos-rebuild switch). It can be
 *   used for additional, maybe non-Nix, config. 
 */
export class NixOSConfigurator {

    readonly instance: NixOSInstance
    readonly args: NixOSConfiguratorArgs
    readonly logger: Logger<CloudyBoxLogObjI>

    private preConfigSteps: NixOSPreConfigStep[]
    private configSteps: NixOSConfigStep[]

    constructor(instance: NixOSInstance, args: NixOSConfiguratorArgs) {
        this.args = args
        this.instance = instance
        this.logger = componentLogger.getSubLogger({ name: instance.hostname })

        this.preConfigSteps = args.additionalPreConfigSteps
        
        this.configSteps = []
        this.configSteps.push(
            async (_: NixOSConfigurator, ssh: SSHClient) => { 
                await this.ensureNixChannel(ssh, this.args.nixosChannel, this.args.homeManagerRelease)
                await this.ensureNixosConfig(ssh, this.args.modules)
            }
        )
        this.configSteps.push(...args.additionalConfigSteps)
    }

    /**
     * Run each config step in order 
     */
    private async doConfigure(){
        
        this.logger.info(`Running ${this.preConfigSteps.length} preConfig steps...`)

        for (const preStep of this.preConfigSteps){
            await preStep(this)
        }
        
        this.logger.info(`Running ${this.configSteps.length} config steps...`)

        const ssh = this.buildSshClient()
        try {
            await this.doWaitForSshConnection(ssh)
            for (const step of this.configSteps){
                await step(this, ssh)
            }
        } finally {
            ssh.dispose()
        }
    }

    public async configure() {
        const o = await this.get()

        this.logger.info(`   Configuring NixOS instance ${this.instance.hostname}`)
        await this.doConfigure()
        this.logger.info(`   NixOS instance ${this.instance.hostname} provisioned !`)

        return o
    }

    public async get() {
        return { 
            hostname: this.instance.hostname 
        }
    }

    async stop() {
        this.runSshCommand(["sudo", "shutdown", "0"])
    }

    async start() {
        throw new Error("Method not implemented.");
    }

    async restart() {
        this.runSshCommand(["sudo", "reboot"])
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
    private async ensureNixosConfig(ssh: SSHClient, modules: NixOSModule[] = []){

        this.logger.info("Preparing NixOS config...")

        const builder = new NixOSFlakeBuilder()
        for (const m of modules){
            builder.add(m)
        }

        const tmpNixOSConfigDir = await builder.build()

        this.logger.info(`Created temporary NixOS configuration in ${tmpNixOSConfigDir}`)

        this.logger.info("Copying NixOS configuration...")
        await ssh.putDirectory(tmpNixOSConfigDir, '/etc/nixos/')
        
        this.logger.info("Rebuilding NixOS configuration...")
        await ssh.command(["nixos-rebuild", "switch", "--upgrade", "--flake", "/etc/nixos#cloudybox"] )
    }

    private buildSshClient(){
        return new SSHClient({
            clientName: `${this.instance.hostname}:ssh`,
            host: this.instance.hostname,
            port: this.args.ssh.port || 22,
            user: this.args.ssh.user || "root",
            privateKeyPath: this.args.ssh.privateKeyPath
        })
    }
}