import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path';
import { PaperspaceInstanceStateV1, PaperspaceProviderStateV0 } from '../providers/paperspace/state';
import { AwsInstanceStateV1, AwsProviderStateV0 } from '../providers/aws/state';
import { getLogger } from '../log/utils';
import { CLOUDYPAD_PROVIDER, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { AzureInstanceStateV1, AzureProviderStateV0 } from '../providers/azure/state';
import { GcpInstanceStateV1, GcpProviderStateV0 } from '../providers/gcp/state';
import { DataHomeUtils } from './data';

export type AnyInstanceStateV1 = AwsInstanceStateV1 | AzureInstanceStateV1 | GcpInstanceStateV1 | PaperspaceInstanceStateV1

/**
 * State utils functions to manage instance state
 * including reading and writing State to disk
 */
export class StateUtils {

    private static readonly logger = getLogger(StateUtils.name)

    static getInstanceDir(instanceName: string){
        return path.join(DataHomeUtils.getInstanceDirPath(), instanceName);
    }
    
    static getInstanceConfigPath(instanceName: string){
        return path.join(this.getInstanceDir(instanceName), "config.yml");
    }

    static listInstances(){
        try {
            const instancesDirPath = DataHomeUtils.getInstanceDirPath()
            this.logger.debug(`Listing all instances from ${instancesDirPath}`)

            const instanceDirs = fs.readdirSync(instancesDirPath);

            return instanceDirs.filter(dir => fs.existsSync(path.join(instancesDirPath, dir, 'config.yml')));
        } catch (error) {
            this.logger.error('Failed to read instances directory:', error);
            return [];
        }
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
    static async loadInstanceState(instanceName: string): Promise<AnyInstanceStateV1>{

        StateUtils.logger.debug(`Loading instance state ${instanceName}`)

        if(!await StateUtils.instanceExists(instanceName)){
            throw new Error(`Instance named '${instanceName}' does not exist.`)
        }

        const configPath = this.getInstanceConfigPath(instanceName)

        this.logger.debug(`Loading instance state ${instanceName} from ${configPath}`)

        const rawState = yaml.load(fs.readFileSync(configPath, 'utf8'))

        const stateV1 = await ensureStateV1(rawState)
        return stateV1
    }

    /**
     * Persist state on disk. 
     */
    static async persistState<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1>(state: InstanceStateV1<C, O>){
        
        await this.ensureInstanceDirExists(state.name)

        const confPath = StateUtils.getInstanceConfigPath(state.name)

        this.logger.debug(`Persisting state for ${state.name} at ${confPath}`)

        fs.writeFileSync(confPath, yaml.dump(state), 'utf-8')
    }

    private static async ensureInstanceDirExists(instanceName: string){
        const instanceDir = StateUtils.getInstanceDir(instanceName)

        if (!fs.existsSync(instanceDir)) {
            this.logger.debug(`Creating instance ${instanceName} directory at ${instanceDir}`)
            
            fs.mkdirSync(instanceDir, { recursive: true });

            this.logger.debug(`Instance ${instanceName} directory created at ${instanceDir}`);
        } else {
            this.logger.trace(`Instance directory already exists at ${instanceDir}`);
        }
    }

    /**
     * Remove an instance directory, effectively deleting everything about this instance.
     */
    static async removeInstanceDir(instanceName: string){
        // Remove state on disk
        const confDir = StateUtils.getInstanceDir(instanceName)

        this.logger.debug(`Removing instance config directory ${instanceName}: '${confDir}'`)

        fs.rmSync(confDir, { recursive: true })
    }
}

/**
 * Ensure a raw state loaded from disk matches the current V1 State interface
 * @param rawState 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureStateV1(rawState: any): Promise<AnyInstanceStateV1>{

    if(rawState.version){
        if(rawState.version != "1") {
            throw new Error("Unknown state version '1'")
        }

        // Nothing do to, state in V1
        // TODO ZOD
        return rawState as AnyInstanceStateV1
    } else {
        // no state version, state is in V0
        // Transform into V1

        const stateV0 = rawState as InstanceStateV0

        const name = stateV0.name

        // Transform provider
        const providerV0 = stateV0.provider
        let stateV1: AnyInstanceStateV1

        let providerName: CLOUDYPAD_PROVIDER

        if(!stateV0.host) {
            throw new Error("Missing host in state. Was instance fully provisioned ?")
        }

        if(!stateV0.ssh || !stateV0.ssh.user || !stateV0.ssh.privateKeyPath) {
            throw new Error("Missing SSh config in state. Was instance fully provisioned ?")
        }

        if(providerV0?.aws) {
            providerName = CLOUDYPAD_PROVIDER_AWS
            if(!providerV0.aws.provisionArgs || !providerV0.aws.provisionArgs.create){
                throw new Error("Missing AWS provision args in state. Was instance fully provisioned ?")
            }

            if(!providerV0.aws.instanceId){
                throw new Error("Missing AWS instance ID in state. Was instance fully provisioned ?")
            }

            const awsState: AwsInstanceStateV1 = {
                name: name,
                version: "1",
                provision: {
                    provider: providerName,
                    output: {
                        host: stateV0.host,
                        instanceId: providerV0.aws.instanceId,
                    },
                    config: {
                        ...providerV0.aws.provisionArgs.create,
                        ssh: {
                            user: stateV0.ssh.user,
                            privateKeyPath: stateV0.ssh.privateKeyPath
                        },
                    }
                },

            }
            stateV1 = awsState

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

            const azureState: AzureInstanceStateV1 = {
                name: name,
                version: "1",
                provision: {
                    provider: providerName,
                    output: {
                        host: stateV0.host,
                        resourceGroupName: providerV0.azure.resourceGroupName,
                        vmName: providerV0.azure.vmName
                    },
                    config: {
                        ...providerV0.azure.provisionArgs.create,
                        ssh: {
                            user: stateV0.ssh.user,
                            privateKeyPath: stateV0.ssh.privateKeyPath
                        },
                    }
                },

            }

            stateV1 = azureState

        } else if (providerV0?.gcp) {

            providerName = CLOUDYPAD_PROVIDER_GCP

            if(!providerV0.gcp.provisionArgs || !providerV0.gcp.provisionArgs.create){
                throw new Error("Missing Google provision args in state. Was instance fully provisioned ?")
            }

            if(!providerV0.gcp.instanceName){
                throw new Error("Missing Google instance name in state. Was instance fully provisioned ?")
            }

            const gcpState: GcpInstanceStateV1 = {
                name: name,
                version: "1",
                provision: {
                    provider: providerName,
                    output: {
                        host: stateV0.host,
                        instanceName: providerV0.gcp.instanceName
                    },
                    config: {
                        ...providerV0.gcp.provisionArgs.create,
                        ssh: {
                            user: stateV0.ssh.user,
                            privateKeyPath: stateV0.ssh.privateKeyPath
                        },
                    }
                },
            }

            stateV1 = gcpState

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

            const pspaceState: PaperspaceInstanceStateV1 = {
                name: name,
                version: "1",
                provision: {
                    provider: providerName,
                    output: {
                        host: stateV0.host,
                        machineId: providerV0.paperspace.machineId
                    },
                    config: {
                        ...providerV0.paperspace.provisionArgs.create,
                        apiKey: providerV0.paperspace.apiKey ?? providerV0.paperspace.provisionArgs.apiKey,
                        ssh: {
                            user: stateV0.ssh.user,
                            privateKeyPath: stateV0.ssh.privateKeyPath
                        },
                    }
                },
            }

            stateV1 = pspaceState

        } else {
            throw new Error(`Unknwon provider in state ${JSON.stringify(providerV0)}`)
        }

        return stateV1

    }
}

/**
 * State representation of Cloudy Pad instance.
 * These data are persisted on disk and loaded in memory,
 * used to manipulate instance for any action.
 */
export interface InstanceStateV1<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1> {

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
        // Generic types, may be more complex
        output?: O,
        config: C,
    },
}

// export interface CommonProvisionStateV1 { 
//     config: CommonProvisionConfigV1, 
//     output?: CommonProvisionOutputV1 
// }

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
 * Provision outputs are data representing Cloud resources and infrastructure after provision
 * such as hostname/IP and relevent provider-specific resources (eg. Cloud virtual machine ID)
 */
export interface CommonProvisionOutputV1 {

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