import { BoxOutput } from "../lib/core.js";
import { NixOSProvisioner } from "../lib/provision/nixos.js";
import { SSHClient, SSHCommandOpts } from "../lib/provision/ssh.js";

export interface NixOSBoxInput {
    host: string
    nixosConfigName: string
    nixosChannel: string
    homeManagerRelease: string
    ssh: {
        user: string
        port?: number
        privateKeyPath?: string
    }
}

export interface NixOSBoxOutput extends BoxOutput {

}


export class NixOSBoxManager {

    readonly args: NixOSBoxInput
    readonly provisioner: NixOSProvisioner
    
    constructor(args: NixOSBoxInput) {
        this.args = args
        this.provisioner = new NixOSProvisioner({
            host: args.host,
            port: args.ssh.port,
            sshKeyPath: args.ssh.privateKeyPath
        })
    }

    public async deploy() {
        console.info("   Provisioning NixOS instance...")
        await this.waitForSsh()
        await this.provisioner.ensureNixChannel(this.args.nixosChannel, this.args.homeManagerRelease)
        await this.provisioner.ensureNixosConfig(this.args.nixosConfigName)
        console.info("   NixOS instance provisioned !")
    }


    private buildSshClient(){
        return new SSHClient({
            host: this.args.host,
            user: "root",
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }

    async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const ssh = this.buildSshClient()        

        try {
            await ssh.connect()
            return await ssh.command(cmd, opts)
        } finally {
            ssh.dispose();
        }
    }

    async waitForSsh(){
        const ssh = this.buildSshClient()
        try {
            return await ssh.waitForConnection()
        } finally {
            ssh.dispose()
        }
    }
}

