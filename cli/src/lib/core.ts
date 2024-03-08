import { WolfAWSBoxManager } from "../boxes/wolf.js"

export interface BoxContext {

}

export interface BoxInput {
    name: string
}

export interface BoxOutput {
}

export interface LinuxMachineBoxOutput extends BoxContext {
    host: string,
    ssh: {
        user: string
        port?: number
        privateKey?: string
    }
}


export function getBoxManager(boxName: string) : WolfAWSBoxManager {

    const manager = new WolfAWSBoxManager(boxName, { 
        aws: { region: "eu-central-1" },
        nixosAmi: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
        sshPrivateKeyPath: "/home/pbeucher/.ssh/id_ed25519",
        sshPublicKeyPath: "/home/pbeucher/.ssh/id_ed25519.pub"
    })

    return manager
}   

