import { SSHClient } from "./ssh.js";
import * as utils from "../../utils.js"
import * as logging from "../logging.js"

export interface NixOSConfiguratorArgs {
    host: string,
    port?: number,
    sshKeyPath?: string
}

/**
 * Manage NixOS machine using configurations in [configs/nix](../../../../configs/nix/)
 */
export class NixOSConfigurator {
    
    args: NixOSConfiguratorArgs

    constructor(args: NixOSConfiguratorArgs){
        this.args = args
    }

    private buildSshClient(){
        return new SSHClient({
            host: this.args.host,
            user: "root",
            port: this.args.port,
            sshKeyPath: this.args.sshKeyPath
        })
    }
    
    /**
     * Ensure NixOS instance channels are set
     */
    async ensureNixChannel(nixosChannel: string, homeManagerRelease?: string){

        const ssh = this.buildSshClient()

        try {
            await ssh.connect()
            
            await ssh.command(["nix-channel", "--add", `https://nixos.org/channels/${nixosChannel}`, "nixos"])
            if (homeManagerRelease){
                await ssh.command(["nix-channel", "--add", `https://github.com/nix-community/home-manager/archive/${homeManagerRelease}.tar.gz`, "home-manager"])
            }
            await ssh.command(["nix-channel", "--update"])

        } catch (error) {
            logging.error(`Failed to update Nix channels: ${error}`);
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
        const configFile = utils.joinSafe(utils.NIX_CONFIGS_DIR, `${nixosConfigName}.nix`)

        try {
            await ssh.connect()
            
            logging.ephemeralInfo("  Copying NixOS configuration...")
            await ssh.putDirectory(utils.NIX_CONFIGS_DIR, '/etc/nixos/')
            await ssh.putFile(configFile, "/etc/nixos/configuration.nix",)
            
            logging.ephemeralInfo("  Rebuilding NixOS configuration...")
            await ssh.command(["nixos-rebuild", "switch", "--upgrade"])

        } catch (error) {
            logging.error(`Failed to switch NixOS config: ${error}`);
            throw error
        } finally {
            ssh.dispose();
        }
    }

}
