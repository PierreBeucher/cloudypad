import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path';
import { PartialDeep } from "type-fest"
import lodash from 'lodash';
import { PaperspaceProviderState } from '../providers/paperspace/state';
import { AwsProviderState } from '../providers/aws/state';
import { getLogger, Logger } from '../log/utils';
import { CLOUDYPAD_INSTANCES_DIR } from './const';
import { AzureProviderState } from '../providers/azure/state';

/**
 * State utils functions to manage instance state
 */
export class StateUtils {

    private static readonly logger = getLogger(StateUtils.name)

    static getInstanceDir(instanceName: string){
        return path.join(CLOUDYPAD_INSTANCES_DIR, instanceName);
    }
    
    static getInstanceConfigPath(instanceName: string){
        return path.join(this.getInstanceDir(instanceName), "config.yml");
    }

    static async instanceExists(instanceName: string): Promise<boolean>{
        const instanceDir = StateUtils.getInstanceDir(instanceName)
        
        StateUtils.logger.debug(`Checking instance ${instanceName} exists at ${instanceDir}`)
        
        return fs.existsSync(instanceDir)
    }

    static async loadInstanceState(instanceName: string): Promise<StateManager>{

        StateUtils.logger.debug(`Loading instance state ${instanceName}`)

        if(!await StateUtils.instanceExists(instanceName)){
            throw new Error("Instance does not exist.")
        }

        const configPath = this.getInstanceConfigPath(instanceName)

        this.logger.debug(`Loading instance state ${instanceName} from ${configPath}`)

        const state = yaml.load(fs.readFileSync(configPath, 'utf8')) as InstanceState; // TODO use Zod
    
        return new StateManager(state)
    }
}
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
        azure?: AzureProviderState
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
        
        const confPath = StateUtils.getInstanceConfigPath(this.state.name)

        this.logger.debug(`Persisting state for ${this.state.name} at ${confPath}`)

        fs.writeFileSync(confPath, yaml.dump(this.state), 'utf-8')
    }
}