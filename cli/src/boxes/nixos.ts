import { BoxOutput } from "../lib/core.js";
import { NixOSProvisioner } from "../lib/provision/nixos.js";

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

    readonly boxInput: NixOSBoxInput
    readonly provisioner: NixOSProvisioner
    
    constructor(box: NixOSBoxInput) {
        this.boxInput = box
        this.provisioner = new NixOSProvisioner({
            host: box.host,
            port: box.ssh.port,
            sshKeyPath: box.ssh.privateKeyPath
        })
    }

    public async deploy() {
        console.info("   Provisioning NixOS instance...")
        await this.provisioner.ensureNixChannel(this.boxInput.nixosChannel, this.boxInput.homeManagerRelease)
        await this.provisioner.ensureNixosConfig(this.boxInput.nixosConfigName)
        console.info("   NixOS instance provisioned !")
    }

    public async runSshCommand(cmd: string[]){
        return this.provisioner.runSshCommand(cmd)
    }
}

