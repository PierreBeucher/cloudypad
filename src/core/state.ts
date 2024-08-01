import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { PartialDeep } from "type-fest"
import lodash from 'lodash';
import { PaperspaceProviderState } from '../providers/paperspace/state';
import { AwsProviderState } from '../providers/aws/state';
import { GlobalInstanceManager } from './manager';
import { getLogger, Logger } from '../log/utils';

/**
 * Current state of a Cloudy Pad instance. It contains every data
 * about an instance: Cloud provider used, how to access, etc.
 * 
 * These data are persisted on disk and loaded in memory. This class
 * thus represent the interface between filesystem and running program data.
 */
export interface InstanceState {
    /**
     * Unique instance name
     */
    name: string,

    /**
     * Provider used by instance. Exactly one is provided.
     */
    provider?: {
        aws?: AwsProviderState
        paperspace?: PaperspaceProviderState
    },

    /**
     * Known public hostname or IP address
     */
    host?: string,

    /**
     * SSH configuration to reach instance
     */
    ssh?: {
        user?: string,
        privateKeyPath?: string,
    }

    /**
     * Current instance status
     */
    status: {
        /**
         * Instance initialization status. An instance is initialize if it's gone through 
         * a full provisioning + configuration process at least once. 
         */
        initalized: boolean

        /**
         * Provisioning status. Provisioning is the act of deploying Cloud resources.
         */
        provision: {

            /**
             * Whether instance has been provisioned at least once
             */
            provisioned: boolean

            /**
             * Last provision date (Linux timestamp)
             */
            lastUpdate?: number
        }

        /**
         * Configuration status. Configuring is the act of csetting up instance OS configuration: drivers, gaming servers, etc.
         */
        configuration: {

            /**
             * Whether instance has been configured at least once
             */
            configured: boolean

            /**
             * Last configuration date (Linux timestamp)
             */
            lastUpdate?: number
        }
    }
}

/**
 * Manage an instance State and its disk persistence
 */
export class StateManager {
    
    private state: InstanceState
    protected readonly logger: Logger
    
    constructor(state: InstanceState){
        this.state = state
        this.logger = getLogger(state.name)
    }

    get(){
        return this.state
    }

    /**
     * Shortcut for get().name
     * @returns name of instance in state
     */
    name(){
        return this.state.name
    }

    async update(data: PartialDeep<InstanceState>){
        this.logger.debug(`Updating state for ${this.state.name}`)
        this.logger.trace(`Updating state for ${this.state.name} with ${JSON.stringify(data)}`)

        lodash.merge(this.state, data)
        await this.persist()
    }

    /**
     * Write state to disk. 
     * TODO use a lock mechanism to avoid concurrent writes 
     */
    async persist(){
        
        const confPath = GlobalInstanceManager.get().getInstanceConfigPath(this.state.name)

        this.logger.debug(`Persisting state for ${this.state.name} at ${confPath}`)

        fs.writeFileSync(confPath, yaml.dump(this.state), 'utf-8')
    }
}