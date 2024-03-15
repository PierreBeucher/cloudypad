import { BoxMetadata } from "../../lib/core.js";
import { NixOSProvisioner } from "../../lib/provision/nixos.js";
import { SSHClient, SSHCommandOpts } from "../../lib/provision/ssh.js";
import { BOX_SCHEMA_BASE } from "../common/base.js";
import { CloudVMBoxManager, CloudVMBoxManagerOutputs as CloudVMBoxOutputs } from "../common/cloud-virtual-machine.js";
import { z } from "zod";

export const BOX_SPEC_NIXOS = z.object({
    nixosConfigName: z.string(),
    nixosChannel: z.string(),
    homeManagerRelease: z.optional(z.string()),
    ssh: z.object({
        privateKeyPath: z.string(),
        port: z.optional(z.number()),
        user: z.optional(z.string())
    })
})

export const BOX_SCHEMA_NIXOS = BOX_SCHEMA_BASE.extend({
    spec: BOX_SPEC_NIXOS
})

export type NixOSBoxSpec = z.infer<typeof BOX_SPEC_NIXOS>
export type NixOSBoxSchema = z.infer<typeof BOX_SCHEMA_NIXOS>

export interface NixOSBoxManagerArgs {
    name: string,
    infraBoxManager: CloudVMBoxManager
    spec: NixOSBoxSpec
}

export class NixOSBoxManager implements CloudVMBoxManager {

    readonly meta: BoxMetadata
    readonly args: NixOSBoxManagerArgs
    readonly spec: NixOSBoxSpec

    constructor(args: NixOSBoxManagerArgs) {
        this.meta = new BoxMetadata({ name: args.name, kind: "linux.nixos"})
        this.args = args
        this.spec = args.spec
    }

    public async deploy() {
        const o = await this.args.infraBoxManager.deploy()
        await this.provision()
        return o
    }

    public async provision() {
        const o = await this.get()
        console.info("   Provisioning NixOS instance...")

        await this.doWaitForSsh(o)

        const nixosPrv = this.buildNixosProvisioner(o)
        await nixosPrv.ensureNixChannel(this.spec.nixosChannel, this.spec.homeManagerRelease)
        await nixosPrv.ensureNixosConfig(this.spec.nixosConfigName)
        console.info("   NixOS instance provisioned !")

        return o
    }

    public async destroy(): Promise<void> {
        return this.args.infraBoxManager.destroy()
    }

    public async preview(): Promise<string> {
        return this.args.infraBoxManager.preview()
    }

    public async get(): Promise<CloudVMBoxOutputs> {
        return this.args.infraBoxManager.get()
    }

    public async stop() {
        return this.args.infraBoxManager.stop()
    }

    public async start() {
        return this.args.infraBoxManager.start()
    }

    public async restart() {
        return this.args.infraBoxManager.restart()
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const o = await this.get()
        return this.doRunSshCommand(o, cmd, opts)
    }

    public async waitForSsh(){
        const o = await this.get()
        this.doWaitForSsh(o)
    }

    public async getMetadata(): Promise<BoxMetadata> {
        return this.meta
    }

    private async doWaitForSsh(o: CloudVMBoxOutputs){
        const ssh = this.buildSshClient(o)
        try {
            return await ssh.waitForConnection()
        } finally {
            ssh.dispose()
        }
    }

    private async doRunSshCommand(o: CloudVMBoxOutputs, cmd: string[], opts?: SSHCommandOpts){
        const ssh = this.buildSshClient(o)        
        try {
            await ssh.connect()
            return await ssh.command(cmd, opts)
        } finally {
            ssh.dispose();
        }
    }

    private buildNixosProvisioner(o: CloudVMBoxOutputs){
        return new NixOSProvisioner({
            host: o.ipAddress,
            port: this.spec.ssh.port,
            sshKeyPath: this.spec.ssh.privateKeyPath
        })
    }

    private buildSshClient(o: CloudVMBoxOutputs){
        return new SSHClient({
            host: o.ipAddress,
            user: this.spec.ssh.user || "root",
            sshKeyPath: this.spec.ssh.privateKeyPath
        })
    }

}

