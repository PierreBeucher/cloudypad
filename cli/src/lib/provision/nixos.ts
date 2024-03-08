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

        const logPrefix = "nixos-update-channel"
        const ssh = this.buildSshClient()

        try {
            await ssh.connect()
            
            // TODO catch stdout/err into variable
            await ssh.command(["sudo", "nix-channel", "--add", `https://nixos.org/channels/${nixosChannel}`, "nixos"], logPrefix)
            await ssh.command(["sudo", "nix-channel", "--add", `https://github.com/nix-community/home-manager/archive/${homeManagerRelease}.tar.gz`, "home-manager"], logPrefix)
            await ssh.command(["sudo", "nix-channel", "--update"], logPrefix)

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
        const logPrefix = "nixos-rebuild"

        const ssh = this.buildSshClient()
        const configFile = utils.joinSafe(utils.NIX_PROVISION_DIR, `${nixosConfigName}.nix`)

        try {
            await ssh.connect()
            
            logging.ephemeralInfo("  Copying NixOS configuration...")
            await ssh.putDirectory(utils.NIX_PROVISION_DIR, '/etc/nixos/')
            await ssh.putFile(configFile, "/etc/nixos/configuration.nix",)
            
            logging.ephemeralInfo("  Rebuilding NixOS configuration...")
            await ssh.command(["sudo", "nixos-rebuild", "switch", "--upgrade"], logPrefix)

        } catch (error) {
            console.error('Failed to update Nix channels: ', error);
            throw error
        } finally {
            ssh.dispose();
        }
    }

    async runSshCommand(cmd: string[]){
        const ssh = this.buildSshClient()        

        try {
            await ssh.connect()
            return await ssh.command(cmd)
        } catch (error) {
            console.error('Failed to run SSH command: ', error);
            throw error
        } finally {
            ssh.dispose();
        }
    }

}
