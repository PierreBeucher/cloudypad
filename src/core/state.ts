import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path';
import lodash from 'lodash';
import { PaperspaceProviderStateV0, PaperspaceProviderStateV1 } from '../providers/paperspace/state';
import { AwsProviderStateV0, AwsProviderV1 } from '../providers/aws/state';
import { getLogger, Logger } from '../log/utils';
import { CLOUDYPAD_INSTANCES_DIR, CLOUDYPAD_PROVIDER, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { AzureProviderStateV0, AzureProviderStateV1 } from '../providers/azure/state';
import { GcpProviderStateV0, GcpProviderStateV1 } from '../providers/gcp/state';

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

    /**
     * Load an instance state from disk into a known, stable object in memory wrapped around a State Manager.
     * Also migrate if needed to expecteed state version. 
     * @param instanceName 
     * @returns 
     */
    static async loadInstanceState(instanceName: string): Promise<StateManager>{

        StateUtils.logger.debug(`Loading instance state ${instanceName}`)

        if(!await StateUtils.instanceExists(instanceName)){
            throw new Error("Instance does not exist.")
        }

        const configPath = this.getInstanceConfigPath(instanceName)

        this.logger.debug(`Loading instance state ${instanceName} from ${configPath}`)

        const rawState = yaml.load(fs.readFileSync(configPath, 'utf8'))

        const stateV1 = await ensureStateV1(rawState)
    
        return new StateManager(stateV1)
    }
}

/**
 * Ensure a raw state loaded from disk matches the current V1 State interface
 * @param rawState 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureStateV1(rawState: any): Promise<InstanceStateV1>{

    if(rawState.version){
        if(rawState.version != "1") {
            throw new Error("Unknown state version '1'")
        }

        // Nothing do to, state in V1
        // TODO ZOD
        return rawState as InstanceStateV1
    } else {
        // no state version, state is in V0
        // Transform into V1

        const stateV0 = rawState as InstanceStateV0

        const name = stateV0.name

        // Transform provider
        const providerV0 = stateV0.provider
        const providerV1: {
            aws?: AwsProviderV1
            paperspace?: PaperspaceProviderStateV1
            azure?: AzureProviderStateV1
            gcp?: GcpProviderStateV1
        } = {}

        let providerName: CLOUDYPAD_PROVIDER

        if(providerV0?.aws) {
            providerName = CLOUDYPAD_PROVIDER_AWS
            if(!providerV0.aws.provisionArgs || !providerV0.aws.provisionArgs.create){
                throw new Error("Missing AWS provision args in state. Was instance fully provisioned ?")
            }

            if(!providerV0.aws.instanceId){
                throw new Error("Missing AWS instance ID in state. Was instance fully provisioned ?")
            }

            providerV1.aws = {
                state: {
                    instanceId: providerV0.aws.instanceId,
                },
                config: providerV0.aws.provisionArgs.create
            }

        } else if (providerV0?.azure) {

            providerName = CLOUDYPAD_PROVIDER_AZURE

            if(!providerV0.azure.provisionArgs || !providerV0.azure.provisionArgs.create){
                throw new Error("Missing Azure provision args in state. Was instance fully provisioned ?")
            }

            if(!providerV0.azure.vmName){
                throw new Error("Missing Azure VM Name in state. Was instance fully provisioned ?")
            }

            if(!providerV0.azure.resourceGroupName){
                throw new Error("Missing Azure Resource Group in state. Was instance fully provisioned ?")
            }

            providerV1.azure = {
                resourceGroupName: providerV0.azure.resourceGroupName,
                vmName: providerV0.azure.vmName,
                provisionArgs: providerV0.azure.provisionArgs.create
            }

        } else if (providerV0?.gcp) {

            providerName = CLOUDYPAD_PROVIDER_GCP

            if(!providerV0.gcp.provisionArgs || !providerV0.gcp.provisionArgs.create){
                throw new Error("Missing Google provision args in state. Was instance fully provisioned ?")
            }

            if(!providerV0.gcp.instanceName){
                throw new Error("Missing Google instance name in state. Was instance fully provisioned ?")
            }

            providerV1.gcp = {
                instanceName: providerV0.gcp.instanceName,
                provisionArgs: providerV0.gcp.provisionArgs.create
            }

        } else if (providerV0?.paperspace) {

            providerName = CLOUDYPAD_PROVIDER_PAPERSPACE

            if(!providerV0.paperspace.provisionArgs || !providerV0.paperspace.provisionArgs.create){
                throw new Error("Missing Paperspace provision args in state. Was instance fully provisioned ?")
            }

            if(!providerV0.paperspace.machineId){
                throw new Error("Missing Paperspace machine ID in state. Was instance fully provisioned ?")
            }

            if(!providerV0.paperspace.apiKey && !providerV0.paperspace.provisionArgs.apiKey){
                throw new Error("Missing Paperspace api key in state. Was instance fully provisioned ?")
            }

            providerV1.paperspace = {
                apiKey: providerV0.paperspace.apiKey ?? providerV0.paperspace.provisionArgs.apiKey,
                machineId: providerV0.paperspace.machineId,
                provisionArgs: providerV0.paperspace.provisionArgs.create
            }

        } else {
            throw new Error(`Unknwon provider in state ${JSON.stringify(providerV0)}`)
        }

        if(!stateV0.host) {
            throw new Error("Missing host in state. Was instance fully provisioned ?")
        }

        if(!stateV0.ssh || !stateV0.ssh.user || !stateV0.ssh.privateKeyPath) {
            throw new Error("Missing SSh config in state. Was instance fully provisioned ?")
        }

        const stateV1: InstanceStateV1 = {
            name: name,
            version: "1",
            provision: {
                common: {
                    config: {
                        ssh: {
                            user: stateV0.ssh.user,
                            privateKeyPath: stateV0.ssh.privateKeyPath
                        },
                    },
                    state: {
                        host: stateV0.host,
                    }
                },
                provider: providerName,
                aws: providerV1.aws,
                azure: providerV1.azure,
                gcp: providerV1.gcp,
                paperspace: providerV1.paperspace,
            }
        }

        return stateV1

    }


}

/**
 * State representation of Cloudy Pad instance.
 * These data are persisted on disk and loaded in memory,
 * used to manipulate instance for any action.
 */
export interface InstanceStateV1 {

    /**
     * This state schema version. Always "1". 
     */
    version: "1",

    /**
     * Unique instance name
     */
    name: string,

    /**
     * Provider used by instance. Exactly one must be set.
     */
    provision: {
        provider: CLOUDYPAD_PROVIDER,
        common: { 
            config: CommonProvisionConfigV1, 
            state?: CommonProvisionStateV1 
        },
        aws?: AwsProviderV1
        paperspace?: PaperspaceProviderStateV1
        azure?: AzureProviderStateV1
        gcp?: GcpProviderStateV1
    },
}

export interface CommonProvisionConfigV1 {
    /**
     * SSH access configuration
     */
    ssh: {
        user: string,
        privateKeyPath: string,
    }
}

/**
 * Generic provision information.
 */
export interface CommonProvisionStateV1 {

    /**
     * Known hostname for instance
     */
    host: string,

}

/**
 * Current state of a Cloudy Pad instance. It contains every data
 * about an instance: Cloud provider used, how to access, etc.
 * 
 * These data are persisted on disk and loaded in memory. This class
 * thus represent the interface between filesystem and running program data.
 */
export interface InstanceStateV0 {
    /**
     * Unique instance name
     */
    name: string,

    /**
     * Provider used by instance. Exactly one is provided.
     */
    provider?: {
        aws?: AwsProviderStateV0
        paperspace?: PaperspaceProviderStateV0
        azure?: AzureProviderStateV0
        gcp?: GcpProviderStateV0
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
    
    private state: InstanceStateV1
    protected readonly logger: Logger
    
    constructor(state: InstanceStateV1){
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

    async update(data: InstanceStateV1){
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