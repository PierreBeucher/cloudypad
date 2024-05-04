import { NixOSConfigurator, NixOSConfiguratorArgs } from './configurator.js';
import { SSHCommandOpts } from '../ssh/client.js';
import { SSHExecCommandResponse } from 'node-ssh';
import { CloudyBoxLogObjI, componentLogger } from '../logging.js';
import { Logger } from 'tslog';

export interface NixOSFleetConfiguratorArgs {
    /**
     * Unique name for this manager, used for identifying in logs.
     */
    name: string

    /**
     * Arguments that will be passed to NixOS configurators for each instances
     */
    configuratorArgs: NixOSConfiguratorArgs

    /**
     * Managed instances
     */
    instances: NixOSInstance[]
}

/**
 * SSH config to access a NixOS instance
 */
export interface NixOSInstance {
    hostname: string,
}

/**
 * Manages a set of hosts and their NixOS configuration. Each instance
 * will be exact clones of one-another as they'll use the same configurator. 
 */
export class NixOSFleetConfigurator {

    readonly args: NixOSFleetConfiguratorArgs
    readonly logger: Logger<CloudyBoxLogObjI>

    constructor(args: NixOSFleetConfiguratorArgs) {
        this.logger = componentLogger.getSubLogger({ name: args.name })
        this.args = args  
    }

    public async configure() {
        const configurators = await this.buildConfigurators()
        const configPromises = configurators.map(c => c.configurator.configure())

        // TODO try catch as one failing promise won't interrupt others
        await Promise.all(configPromises)
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts): Promise<{ configurator: NixOSConfigurator, sshRes: SSHExecCommandResponse }[]> {
        const configurators = await this.buildConfigurators()
        const result = configurators.map(async c => {
            const sshRes = await c.configurator.runSshCommand(cmd, opts)
            return { configurator: c.configurator, sshRes: sshRes }
        })

        return Promise.all(result)
    }

    /**
     * Build NixOS configurators for this manager's replicas
     */
    private async buildConfigurators() : Promise<{ instance: NixOSInstance, configurator: NixOSConfigurator }[]> {
        
        return this.args.instances.map(inst => {
            
            const configurator = new NixOSConfigurator(inst, this.args.configuratorArgs)

            return {
                instance: inst,
                configurator: configurator
            }
        })
    }

}