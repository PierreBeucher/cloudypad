import { SSHClient } from "./ssh.js";
import * as utils from "../../utils.js"
import * as logging from "../logging.js"

export interface NixOSProvisionerArgs {
    host: string,
    port?: number,
    sshKeyPath?: string
}

/**
 * Manage NixOS machine provisioning using configurations in [provision/nix](../../../../provision/nix/)
 */
export class NixOSProvisioner {
    
    args: NixOSProvisionerArgs

    constructor(args: NixOSProvisionerArgs){
        this.args = args
    }

    private buildSshClient(){
        return new SSHClient({
            host: this.args.host,
            user: "root",
            sshKeyPath: this.args.sshKeyPath
        })
    }
    
    /**
     * Ensure NixOS instance channels are set
     */
    async ensureNixChannel(nixosChannel: string, homeManagerRelease: string){

        const ssh = this.buildSshClient()

        try {
            await ssh.connect()
            
            await ssh.command(["nix-channel", "--add", `https://nixos.org/channels/${nixosChannel}`, "nixos"])
            await ssh.command(["nix-channel", "--add", `https://github.com/nix-community/home-manager/archive/${homeManagerRelease}.tar.gz`, "home-manager"])
            await ssh.command(["nix-channel", "--update"])

        } catch (error) {
            console.error('Failed to update Nix channels: ', error);
            throw error
        } finally {
            ssh.dispose();
        }
    }

    /**
     * Copy NixOS configuration and run nixos-rebuild --switch
     */
    async ensureNixosConfig(nixosConfigName: string){

        logging.ephemeralInfo("  Rebuilding NixOS config...")

        const ssh = this.buildSshClient()
        const configFile = utils.joinSafe(utils.NIX_PROVISION_DIR, `${nixosConfigName}.nix`)

        try {
            await ssh.connect()
            
            logging.ephemeralInfo("  Copying NixOS configuration...")
            await ssh.putDirectory(utils.NIX_PROVISION_DIR, '/etc/nixos/')
            await ssh.putFile(configFile, "/etc/nixos/configuration.nix",)
            
            logging.ephemeralInfo("  Rebuilding NixOS configuration...")
            await ssh.command(["nixos-rebuild", "switch", "--upgrade"])

        } catch (error) {
            console.error('Failed to switch NixOS config: ', error);
            throw error
        } finally {
            ssh.dispose();
        }
    }

}
