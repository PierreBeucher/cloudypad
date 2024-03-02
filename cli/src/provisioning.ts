import { NodeSSH } from 'node-ssh';
import { BoxInfraDetails } from './infra';
import * as upath from "upath";

const PROVISION_DIR = upath.joinSafe(__dirname, "..", "..", "provision")
const NIX_PROVISION_DIR = upath.joinSafe(PROVISION_DIR, "nix")
const WOLF_PROVISION_DIR = upath.joinSafe(PROVISION_DIR, "wolf")
/**
 * Provision a NixOS host with given NixOS configuration
 * @param boxInfraDetails Box details
 * @param nixConfig name of the Nix config to use as /etc/nixos/configuration.nix
 */
export async function nixSshProvision(box: BoxInfraDetails, nixConfig: string){
    const ssh = await sshBox(box)
    try {
        console.info("Copying NixOS configuration...")
        await sshPutDirectory(ssh, NIX_PROVISION_DIR, '/etc/nixos/')
        await ssh.putFile(upath.joinSafe(NIX_PROVISION_DIR, nixConfig), "/etc/nixos/configuration.nix",)
        
        console.info("Updating NixOS configuration...")
        await sshExec(ssh, ["sudo", "nix-channel", "--add", "https://nixos.org/channels/nixos-23.05", "nixos"], "nixos-rebuild")
        await sshExec(ssh, ["sudo", "nixos-rebuild", "switch", "--upgrade"], "nixos-rebuild")

    } catch (error) {
      console.error('Failed to run provisioning via ssh: ', error);
      throw error
    } finally {
      ssh.dispose();
    }
}

export async function wolfSshProvisioning(box: BoxInfraDetails){
    const ssh = await sshBox(box)
    try {
        console.info("Copying Wolf configuration...")
        await sshPutDirectory(ssh, WOLF_PROVISION_DIR, "/root/wolf")
        // await sshExec(ssh, ["sudo", "nixos-rebuild", "switch"], "nixos-rebuild")
    } finally {
        ssh.dispose()
    }
}

async function sshPutDirectory(ssh: NodeSSH, src: string, dest: string){
    const putStatus = await ssh.putDirectory(src, dest, {
        transferOptions: {

        },
        recursive: true,
        concurrency: 10,
        validate: (itemPath) => {
            console.log(`Transferring ${itemPath}`);
            return true;
        },
        tick: function(localPath, remotePath, error) {
            if (error) {
                console.error(`Failed to copy ${localPath} to ${remotePath}: ${error}`)
            }
        }
    })

    if (!putStatus) {
        throw new Error("Some file(s) failed to transfer.")
    }
}

async function sshExec(ssh: NodeSSH, exec: string[], logPrefix: string, stderrLogPefix?: string){
    if (!exec.length){
        throw new Error("No command provided.")
    }
    const command = exec[0]
    await ssh.exec(command, exec.slice(1), {
        stream: "both",
        onStdout(chunk) {
            console.log(`${logPrefix}: `, chunk.toString('utf8').trim())
        },
        onStderr(chunk) {
            console.log(`${stderrLogPefix || logPrefix}: `, chunk.toString('utf8').trim())
        }
    })
}

async function sshBox(box: BoxInfraDetails) : Promise<NodeSSH> {
    return new NodeSSH().connect({
        host: box.host,
        username: box.ssh.user,
        privateKeyPath: '/home/pbeucher/.ssh/id_ed25519', // TODO use key automatically
    });
}