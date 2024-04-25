import { SSHClient, SSHCommandOpts } from "../../lib/ssh/client.js";
import { BoxBase, BoxConfigurator } from "../common/base.js";
import { NixOSModule, NixOSModuleDirectory } from "../../lib/nix/interfaces.js";
import * as fs from 'fs';
import * as fsx from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { SSHDefinition } from "../common/virtual-machine.js";
import { osFlake } from "../../lib/nix/modules/nixos-flake.nix.js";

export interface NixOSConfiguratorArgs {

    hostname: string
    ssh: SSHDefinition,

    nixosChannel: string
    homeManagerRelease: string

    /**
     * Module to use as configuration.nix
     */
    modules?: NixOSModule[]

    /**
     * 
     */
    modulesDirs?: NixOSModuleDirectory[]

    /**
     * Install steps run before initial SSH connection to run NixOS rebuild..
     */
    additionalPreConfigSteps?: NixOSPreConfigStep[]

    /**
     * Install steps run after NixOS rebuild.
     */
    additionalConfigSteps?: NixOSConfigStep[]
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
export class NixOSConfigurator extends BoxBase implements BoxConfigurator {

    readonly args: NixOSConfiguratorArgs

    private preConfigSteps: NixOSPreConfigStep[]
    private configSteps: NixOSConfigStep[]

    constructor(name: string, args: NixOSConfiguratorArgs) {
        super({ name: name, kind: NIXOS_BOX_CONFIGURATOR_KIND})
        this.args = args
        
        this.preConfigSteps = args.additionalPreConfigSteps || []
        
        this.configSteps = []
        this.configSteps.push(
            async (_: NixOSConfigurator, ssh: SSHClient) => { 
                await this.ensureNixChannel(ssh, this.args.nixosChannel, this.args.homeManagerRelease)
                await this.ensureNixosConfig(ssh, this.args.modules, this.args.modulesDirs)
            }
        )
        this.configSteps.push(...args.additionalConfigSteps || [])
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

        this.logger.info(`   Configuring NixOS instance ${this.metadata.name}`)
        await this.doConfigure()
        this.logger.info(`   NixOS instance ${this.metadata.name} provisioned !`)

        return o
    }

    public async get() {
        return { 
            hostname: this.args.hostname 
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
    private async ensureNixosConfig(ssh: SSHClient, modules: NixOSModule[] = [], modulesDirs: NixOSModuleDirectory[] = []){

        this.logger.info("  Preparing NixOS config...")

        // Write will module file to destination:
        // - create empty build dir
        // - copy all modules into build dir
        // - copy all modules dirs into build dir
        // - create a flake.nix aggregating modules and modules dirs into an OS config
        const tmpModuleDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cloudybox-nixos-"))
        this.logger.info(`  Building NixOS module in ${tmpModuleDir}...`)

        // All modules to import in main NixOS flake.nix
        const mainModuleImports: string[] = modules.map(m => m.name)
        const mainModule = osFlake(mainModuleImports)

        // Write all modules and submodules into build dir
        for (const m of modules.concat(mainModule)){
            await this.writeModulesTmp(tmpModuleDir, m)
            mainModuleImports.push(m.name)
        }

        for (const md of modulesDirs){
            await this.writeModulesDirsTmp(tmpModuleDir, md)
            mainModuleImports.push(md.name)
        }

        this.logger.info("  Copying NixOS configuration...")
        await ssh.putDirectory(tmpModuleDir, '/etc/nixos/')
        
        this.logger.info("  Rebuilding NixOS configuration...")
        await ssh.command(["nixos-rebuild", "switch", "--upgrade", "--flake", "/etc/nixos#cloudybox"] )
    }

    private async writeModulesTmp(tmpDir: string, module: NixOSModule){
        this.logger.info(`Copying module ${module.name}`)

        const modulePath = path.join(tmpDir, `${module.name}`);
        if (module.content) {
            await fs.promises.writeFile(modulePath, module.content);
        } else if (module.path) {
            await fs.promises.copyFile(module.path, modulePath);
        } else {
            throw new Error(`Module must have a path or a content: ${JSON.stringify(module)}`)
        }
        
        for (const subm of module.modules || []) {
            await this.writeModulesTmp(tmpDir, subm);
        }
    }

    private async writeModulesDirsTmp(tmpDir: string, module: NixOSModuleDirectory){
        this.logger.info(`Copying module dir ${module.name} (${module.path})`)

        const newModuleDirPath = path.join(tmpDir, `${module.name}`);
        await fsx.copy(module.path, newModuleDirPath)
    }

    private buildSshClient(){
        return new SSHClient({
            clientName: `${this.metadata.kind}:${this.metadata.name}:ssh`,
            host: this.args.hostname,
            user: this.args.ssh.user || "root",
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }
}