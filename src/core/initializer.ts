import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { input, select, confirm } from '@inquirer/prompts';
import { CommonProvisionInputV1, InstanceStateV1 } from './state/state';
import { getLogger } from '../log/utils';
import { PartialDeep } from 'type-fest';
import { InstanceManager } from './manager';
import { CLOUDYPAD_PROVIDER, PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from './const';
import { StateManager } from './state/manager';
import { InstanceManagerBuilder } from './manager-builder';
import lodash from 'lodash'
const { kebabCase } = lodash

export interface InstanceInitializationOptions {
    autoApprove?: boolean
    overwriteExisting?: boolean
}

export interface InstanceInitArgs<C> {
    instanceName?: string,
    input: PartialDeep<C>
}

/**
 * Instance initializer create the initial state of an instance and
 * pass through various initialization phases, updating instance state as it goes:
 * - Initial state creation
 * - Provisioning
 * - Configuration
 * - Pairing
 * 
 * Helper prompts by provider are used to gather user inputs, either
 * from CLI flags or by letting user choose interactively. 
 */
export interface InstanceInitializer {

    /**
     * Initialize instance:
     * - Prompt for common and provisioner-specific configs
     * - Initialize state
     * - Run provision
     * - Run configuration
     * - Optionally pair instance
     * @param opts 
     */
    initializeInstance(input: CommonProvisionInputV1, opts: InstanceInitializationOptions): Promise<void>

}

export abstract class AbstractInstanceInitializer<C extends CommonProvisionInputV1> {

    protected readonly logger = getLogger(AbstractInstanceInitializer.name)

    protected readonly provider: CLOUDYPAD_PROVIDER
    protected readonly args: InstanceInitArgs<C>
    protected stateManager: StateManager

    constructor(provider: CLOUDYPAD_PROVIDER, args: InstanceInitArgs<C>){
        this.provider = provider
        this.args = args
        this.stateManager = StateManager.default()
    }

    private async promptCommonConfig(): Promise<{ name: string, input: CommonProvisionInputV1 }> {

        this.logger.debug(`Initializing instance with default config ${JSON.stringify(this.args)}`)
        
        const commonConfPrompt = new CommonConfigPrompt()
        const instanceName = await commonConfPrompt.instanceName(this.args?.instanceName)
        const sshKey = await commonConfPrompt.privateSshKey(this.args?.input?.ssh?.privateKeyPath)
        const sshUser = "ubuntu" // Harcoded for now since we only support Ubuntu

        return {
            name: instanceName,
            input: {
                ssh: {
                    privateKeyPath: sshKey,
                    user: sshUser
                }
            }
        }
    }

    /**
     * Prompt user for additional provider-specific configurations.
     * Returns a fully valid state for instance initialization. 
     */
    protected abstract promptProviderConfig(commonInput: CommonProvisionInputV1): Promise<C>

    protected buildInstanceManager(state: InstanceStateV1): InstanceManager {
        return new InstanceManagerBuilder().buildManagerForState(state)
    }

    public async initializeInstance(opts: InstanceInitializationOptions){

        const { name: instanceName, input: commonConfig } = await this.promptCommonConfig();

        if(await this.stateManager.instanceExists(instanceName) && !opts.overwriteExisting){
            const confirmAlreadyExists = await confirm({
                message: `Instance ${instanceName} already exists. Do you want to overwrite existing instance config?`,
                default: false,
            })
            
            if (!confirmAlreadyExists) {
                throw new Error("Won't overwrite existing instance. Initialization aborted.")
            }
        }


        const finalConfig = await this.promptProviderConfig(commonConfig)

        this.logger.debug(`Initializing a new instance with config ${JSON.stringify(finalConfig)}`)

        // Create the initial state
        const initialState: InstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: this.provider,
                input: finalConfig,
                output: undefined
            },   
        }
                
        const instanceManager = await this.buildInstanceManager(initialState)

        this.logger.info(`Initializing ${instanceName}: provisioning...`)

        await instanceManager.provision(opts)

        this.logger.info(`Initializing ${instanceName}: provision done.}`)

        this.logger.info(`Initializing ${instanceName}: configuring...}`)
        
        await instanceManager.configure()

        this.logger.info(`Initializing ${instanceName}: configuration done.}`)

        const doPair = opts.autoApprove ? true : await confirm({
            message: `Your instance is almost ready ! Do you want to pair Moonlight now?`,
            default: true,
        })

        if (doPair) {
            this.logger.info(`Initializing ${instanceName}: pairing...}`)

            await instanceManager.pair()
    
            this.logger.info(`Initializing ${instanceName}: pairing done.}`)
        } else {
            this.logger.info(`Initializing ${instanceName}: pairing skipped.}`)
        }
    }
}

export class CommonConfigPrompt {

    private readonly logger = getLogger(CommonConfigPrompt.name)

    async instanceName(_instanceName?: string): Promise<string> {
        let instanceName: string
        
        if (_instanceName) {
            instanceName = _instanceName
        } else {
            const userInfo = os.userInfo()
            const defaultInstanceName = `${userInfo.username}`;
            instanceName = await input({
                message: 'Enter instance instanceName:',
                default: defaultInstanceName,
            })
        }

        // Ensure instance name is kebab case
        const kebabCaseInstanceName = kebabCase(instanceName)

        if(kebabCaseInstanceName !== instanceName) {
            const confirmKebabCase = await confirm({
                message: `Instance name must be kebab case. Use ${kebabCaseInstanceName} instead?`,
                default: true,
            })

            if(!confirmKebabCase){
                // let's ask again, without provided default
                return this.instanceName()
            }
        }

        
        return kebabCaseInstanceName 
    }

    async privateSshKey(privateSshKey?: string): Promise<string> {
        if (privateSshKey) {
            return privateSshKey;
        }

        const sshDir = path.join(os.homedir(), '.ssh')

        this.logger.debug(`Looking for SSH keys in ${sshDir}`)

        let sshFiles: string[] = []
        if(fs.existsSync(sshDir) && fs.statSync(sshDir).isDirectory()) {
            sshFiles = fs.readdirSync(sshDir)
            this.logger.debug(`Found SSH key files ${JSON.stringify(sshFiles)}`)
        } else {
            this.logger.debug(`Couldn't find SSH private key, not a directory: ${sshDir}`)
        }

        const privateKeys = sshFiles
            .filter(file => file.startsWith('id_') && !file.endsWith('.pub')) // TODO A bit naive method. Maybe we can read all files and check if they are private keys
            .map(file => path.join(sshDir, file))
    
        let privateKeyPath: string
        if (!privateKeys.length){
            console.info(`No SSH private key found in ${sshDir}. You can generate one with 'ssh-keygen -t ed25519 -a 100'.`)
            privateKeyPath = await input({
                message: 'Please enter path to a valid SSH private key to create your instance:'
            })
        } else {
        const sshKeyChoices = privateKeys.map(k => ({
            instanceName: k,
            value: k
        }))
    
            privateKeyPath = await select({
            message: 'Choose an SSH private key to connect to instance:',
            choices: sshKeyChoices
        })
        }

        console.info(`Using SSH private key ${privateKeyPath}`)
    
        return privateKeyPath;
    }
}

/**
 * Static initialization methods which can be used by other initializers
 */
export class StaticInitializerPrompts {
    
    static async useSpotInstance(useSpot?: boolean): Promise<boolean>{
        if (useSpot) {
            return useSpot;
        }

        const useSpotChoice = await confirm({
            message: `Do you want to use spot instances ? Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.`,
            default: true,
        })
    
        return useSpotChoice;
    }

    static async publicIpType(publicIpType?: PUBLIC_IP_TYPE): Promise<PUBLIC_IP_TYPE> {
        if (publicIpType) {
            return publicIpType
        }

        const publicIpTypeChoices: {name: PUBLIC_IP_TYPE, value: PUBLIC_IP_TYPE }[] = [{
            name: PUBLIC_IP_TYPE_STATIC,
            value: PUBLIC_IP_TYPE_STATIC
        },{
            name: PUBLIC_IP_TYPE_DYNAMIC,
            value: PUBLIC_IP_TYPE_DYNAMIC
        }]

        return await select({
            message: 'Use static Elastic IP or dynamic IP? :',
            choices: publicIpTypeChoices,
            default: PUBLIC_IP_TYPE_STATIC,
        })
    }
}