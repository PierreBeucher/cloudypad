import { NodeSSH } from "node-ssh";
import { BoxInfraDetails } from "./infra.js";
import * as utils from "./utils.js"
import * as logging from "./logging.js"

/**
 * Provision a NixOS host with given NixOS configuration
 * @param boxInfraDetails Box details
 * @param nixConfig name of the Nix config to use as /etc/nixos/configuration.nix
 */
export async function nixSshProvision(box: BoxInfraDetails, nixConfig: string){
    const ssh = await sshBox(box)
    try {
        console.info("  Copying NixOS configuration...")
        await sshPutDirectory(ssh, utils.NIX_PROVISION_DIR, '/etc/nixos/')
        await ssh.putFile(utils.joinSafe(utils.NIX_PROVISION_DIR, nixConfig), "/etc/nixos/configuration.nix",)
        
        console.info("  Updating NixOS configuration...")
        await sshExec(ssh, ["sudo", "nix-channel", "--add", "https://nixos.org/channels/nixos-23.05", "nixos"], "nixos-rebuild")
        await sshExec(ssh, ["sudo", "nix-channel", "--add", "https://github.com/nix-community/home-manager/archive/release-23.05.tar.gz", "home-manager"], "nixos-rebuild")
        await sshExec(ssh, ["sudo", "nix-channel", "--update"], "nixos-rebuild")
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
        console.info("  Copying Wolf configuration...")
        await sshPutDirectory(ssh, utils.WOLF_PROVISION_DIR, "/root/wolf")
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
            logging.gray(`Transferring ${itemPath}`)
            return true;
        },
        tick: function(localPath, remotePath, error) {
            if (error) {
                console.error(`Failed to copy ${localPath} to ${remotePath}: ${error}`)
            }
        }
    })
    logging.clear()

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
            logging.gray(`${logPrefix}: ${chunk.toString('utf8').trim()}`, )
        },
        onStderr(chunk) {
            logging.gray(`${stderrLogPefix || logPrefix}: ${chunk.toString('utf8').trim()}`)
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