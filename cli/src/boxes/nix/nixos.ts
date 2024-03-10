import { NixOSProvisioner } from "../../lib/provision/nixos.js";
import { SSHClient, SSHCommandOpts } from "../../lib/provision/ssh.js";
import { CloudVMBoxManager, CloudVMBoxManagerOutputs as CloudVMBoxOutputs } from "../common/cloud-virtual-machine.js";

export interface NixOSBoxArgs {
    infraBoxManager: CloudVMBoxManager
    nixosConfigName: string
    nixosChannel: string
    homeManagerRelease: string
    ssh: {
        user?: string
        port?: number
        privateKeyPath: string
    }
}


export class NixOSBoxManager implements CloudVMBoxManager{

    readonly args: NixOSBoxArgs
    
    constructor(args: NixOSBoxArgs) {
        this.args = args
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
        await nixosPrv.ensureNixChannel(this.args.nixosChannel, this.args.homeManagerRelease)
        await nixosPrv.ensureNixosConfig(this.args.nixosConfigName)
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

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const o = await this.get()
        return this.doRunSshCommand(o, cmd, opts)
    }

    async waitForSsh(){
        const o = await this.get()
        this.doWaitForSsh(o)
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
            port: this.args.ssh.port,
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }

    private buildSshClient(o: CloudVMBoxOutputs){
        return new SSHClient({
            host: o.ipAddress,
            user: this.args.ssh.user || "root",
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }

}

