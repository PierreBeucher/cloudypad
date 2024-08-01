import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { input, select, confirm } from '@inquirer/prompts';
import { AnsibleConfigurator } from '../configurators/ansible';
import { InstanceState, StateManager, StateUtils } from './state';
import { getLogger } from '../log/utils';
import { PartialDeep } from 'type-fest';

export interface GenericInitializationArgs {
    instanceName: string,
    sshKey: string
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
export abstract class InstanceInitializer {

    private readonly logger = getLogger(InstanceInitializer.name)

    private readonly defaultArgs: PartialDeep<GenericInitializationArgs>

    constructor(defaultGenericArgs?: PartialDeep<GenericInitializationArgs>){
        this.defaultArgs = defaultGenericArgs ?? {}
    }

    protected async getGenericInitArgs(): Promise<GenericInitializationArgs> {

        this.logger.debug(`Creating instance: default generic arguments ${JSON.stringify(this.defaultArgs)}`)
        
        const genericPromt = new GenericInitializerPrompt()
        const name = await genericPromt.instanceName(this.defaultArgs?.instanceName)
        const sshKey = await genericPromt.privateSshKey(this.defaultArgs?.sshKey)

        return {
            instanceName: name,
            sshKey: sshKey
        }
    }

    protected abstract runProvisioning(sm: StateManager): Promise<void>

    protected abstract runPairing(sm: StateManager): Promise<void>
    
    protected async runConfiguration(sm: StateManager){
        // Ignore host key checking only during initialization to bypass host key checking
        // which will be unkwown anyway as it's a new cloud machine
        // This will persist host key in known_hosts for subsequent runs
        const additionalAnsibleArgs = ['-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\'']
        const configurator = new AnsibleConfigurator(sm, additionalAnsibleArgs)
        await configurator.configure()
    }

    public async initializeInstance(){

        const genericArgs = await this.getGenericInitArgs()

        this.logger.debug(`Initializing a new instance with args ${JSON.stringify(genericArgs)}`)
        
        console.info(`Creating instance ${genericArgs.instanceName}`)
        this.logger.info(`Creating instance ${genericArgs.instanceName}²`)
        
        const initialState: InstanceState = {
            name: genericArgs.instanceName,
            ssh: {
                privateKeyPath: genericArgs.sshKey,
            },
            status: {
                initalized: false,
                configuration: {
                    configured: false
                },
                provision: {
                    provisioned: false
                }
            }
        }

        this.logger.debug(`Creating ${genericArgs.instanceName}: initial state is ${JSON.stringify(initialState)}`)

        const sm = new StateManager(initialState)

        // Create instance directory in which to persist state
        const instanceDir = StateUtils.getInstanceDir(genericArgs.instanceName)

        this.logger.debug(`Creating ${genericArgs.instanceName}: creating instance dir at ${instanceDir}`)

        fs.mkdirSync(instanceDir, { recursive: true })
        
        this.logger.info(`Creating ${genericArgs.instanceName}: provisionning...}`)
        this.logger.debug(`Creating ${genericArgs.instanceName}: starting provision with state ${sm.get()}`)
        
        await this.runProvisioning(sm)
        
        this.logger.info(`Creating ${genericArgs.instanceName}: provision done.}`)

        this.logger.info(`Creating ${genericArgs.instanceName}: configuring...}`)
        
        await this.runConfiguration(sm)
        
        this.logger.info(`Creating ${genericArgs.instanceName}: configuration done.}`)

        const doPair = await confirm({
            message: `Your instance is almost ready ! Do you want to pair Moonlight now?`,
            default: true,
        })

        if (doPair) {
            this.logger.info(`Creating ${genericArgs.instanceName}: pairing...}`)

            await this.runPairing(sm)

            this.logger.info(`Creating ${genericArgs.instanceName}: pairing done.}`)
        } else {
            this.logger.info(`Creating ${genericArgs.instanceName}: pairing skipped.}`)
        }

        console.info("")
        console.info("Instance has been initialized successfully 🥳")
        console.info("")
        console.info("If you like Cloudy Pad please leave us a star ⭐ https://github.com/PierreBeucher/cloudypad")
        console.info("")
        console.info("🐛 A bug ? Some feedback ? Do not hesitate to file an issue: https://github.com/PierreBeucher/cloudypad/issues")
        
    }
}

export class GenericInitializerPrompt {

    private readonly logger = getLogger(GenericInitializerPrompt.name)

    async instanceName(_instanceName?: string): Promise<string> {
        let instanceName: string
        
        if (_instanceName) {
            instanceName = _instanceName
        } else {
            const userInfo = os.userInfo()
            const defaultInstanceName = `${userInfo.username}`;
            instanceName = await input({
                message: 'Enter instance name:',
                default: defaultInstanceName,
            })
        }

        if(await StateUtils.instanceExists(instanceName)){
            const confirmAlreadyExists = await confirm({
                message: `Instance ${instanceName} already exists. Do you want to overwrite existing instance config?`,
                default: false,
            })
            if (!confirmAlreadyExists) {
                throw new Error("Won't overwrite existing instance. Initialization aborted.")
            }
        }

        return instanceName
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
            name: k,
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