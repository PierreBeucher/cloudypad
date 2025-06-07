import { getLogger } from '../log/utils';
import { InstanceManager } from './manager';
import { StateLoader } from './state/loader';
import { StateManagerBuilder } from './state/builders';
import { CoreConfig } from './config/interface';
import { InstanceManagerBuilder } from './manager-builder';

// This is the global config !
export interface CloudypadClientArgs {
    config: CoreConfig
}

/**
 * Build InstanceManager from state. This is the main entry point for InstanceManager instantiation.
 * 
 * To Build an InstanceManager, related provider for State must be registered first using registerProvider().
 * Cloudy Pad Core providers are already registered, but more custom providers can be registered.
 */
export class CloudypadClient {

    private readonly args: CloudypadClientArgs
    private readonly logger = getLogger(CloudypadClient.name)

    constructor(args: CloudypadClientArgs) {
        if (args.config.stateBackend.s3 && args.config.stateBackend.local || !args.config.stateBackend.s3 && !args.config.stateBackend.local) {
            throw new Error("Exactly one of s3 or local data backend must be provided, got: " + JSON.stringify(args.config.stateBackend))
        }

        this.args = args
    }

    private buildStateManagerBuilder(): StateManagerBuilder {
        return new StateManagerBuilder({
            stateBackend: {
                local: this.args.config.stateBackend.local,
                s3: this.args.config.stateBackend.s3
            }
        })
    }


    /**
     * Get a generic StateLoader for the configured state backend.
     */
    getStateLoader(): StateLoader {
        return this.buildStateManagerBuilder().buildStateLoader()
    }

    async getAllInstances(): Promise<string[]> {
        return this.getStateLoader().listInstances()
    }

    async instanceExists(instanceName: string): Promise<boolean> {
        const loader = this.buildStateManagerBuilder().buildStateLoader()
        return loader.instanceExists(instanceName)
    }

    async buildInstanceManager(instanceName: string): Promise<InstanceManager> {
        const mb = new InstanceManagerBuilder({ config: this.args.config })
        return mb.buildInstanceManager(instanceName)
    }
}
  