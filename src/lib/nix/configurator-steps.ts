//
// Re-usable config steps for NixOSBoxConfigurator 
//

import { SSHClient } from "../ssh/client.js";
import { NixOSConfigurator, NixOSPreConfigStep } from "./configurator.js";

/**
 * Try to install NixOS via nixos-infect if not already done. 
 */
export const nixOSInfect: NixOSPreConfigStep = async (cfgtor: NixOSConfigurator) => {
    const boxDetails = await cfgtor.get()

    const rootClient = new SSHClient({
        clientName: `${cfgtor.instance.hostname}-preconfig-root`,
        host: boxDetails.hostname,
        user: "root",
        privateKeyPath: cfgtor.args.ssh.privateKeyPath
    });

    // Attempt to connect as root
    // If successfull, try to run a command
    // By default Paperspace won't allow SSH connection with shell on root
    // so it would result in an error if NixOS is not yet installed
    try {
        await rootClient.waitForConnection();
    } catch (error) {
        rootClient.dispose()
        cfgtor.logger.error(`Couldn't connect to box: ${JSON.stringify(error)}`)
        throw error
    } 

    try {
        await rootClient.command(["echo", "Can I run ?"])
    } catch (error) {

        cfgtor.logger.error(`Caught an expected error in NixOS infect step: ${error}`)

        // If root connection fails, try with 'paperspace' user
        // to run NixOS infect
        const paperspaceClient = new SSHClient({
            clientName: `${cfgtor.instance.hostname}-preconfig-paperspace`,
            host: boxDetails.hostname,
            user: "paperspace",
            privateKeyPath: cfgtor.args.ssh.privateKeyPath
        });
        try {
            
            cfgtor.logger.info("Installing NixOS via nixos-infect...")

            // Install NixOS via nixos-infect
            // No reboot to avoid error thrown by ssh client (reboot causes non-0 exit code)
            await paperspaceClient.connect();
            await paperspaceClient.command([
                "NIX_CHANNEL=nixos-23.11 NO_REBOOT=1",
                "sh", "-c",     
                "curl -s -S https://raw.githubusercontent.com/elitak/nixos-infect/master/nixos-infect | sudo -E bash"
            ]);
            
            cfgtor.logger.info("NixOS installed! Rebooting...")

            try {
                await paperspaceClient.command(["sudo", "reboot"]);
            } catch(error) {
                // no-op: error expected on reboot
            }

        } finally {
            paperspaceClient.dispose();
        }
    } finally {
        rootClient.dispose();
    }
};