import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PartialDeep } from "type-fest"
import { input, select, confirm } from '@inquirer/prompts';
import lodash from 'lodash'
import { CommonInstanceInput } from "../state/state";
import { getLogger } from "../../log/utils";
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from '../const';
import { CreateCliArgs } from './cli';
const { kebabCase } = lodash

export interface InputPrompter {

    /**
     * Given some CLI arguments, ensure a full instance Input is returned.
     * Eg. prompt user for missing inputs.
     */
    completeCliInput(cliArgs: CreateCliArgs): Promise<CommonInstanceInput>
}

export abstract class AbstractInputPrompter<A extends CreateCliArgs, I extends CommonInstanceInput> implements InputPrompter {

    protected readonly logger = getLogger(AbstractInputPrompter.name)

    /**
     * Prompt user for additional provider-specific inputs based on common provider inputs.
     * Returns a fully valid state for instance initialization. 
     */
    async promptInput(partialInput: PartialDeep<I>): Promise<I> {
        const commonInput = await this.promptCommonInput(partialInput)
        const commonInputWithPartial = lodash.merge({}, commonInput, partialInput)
        const finalInput = await this.promptSpecificInput(commonInputWithPartial)
        return finalInput
    }
    
    private async promptCommonInput(partialInput: PartialDeep<CommonInstanceInput>): Promise<CommonInstanceInput> {

        this.logger.debug(`Initializing instance with default config ${JSON.stringify(partialInput)}`)
        
        const instanceName = await this.instanceName(partialInput.instanceName)
        const sshKey = await this.privateSshKey(partialInput.provision?.ssh?.privateKeyPath)
        const sshUser = "ubuntu" // Harcoded default for now since we only support Ubuntu

        return {
            instanceName: instanceName,
            provision: {
                ssh: {
                    privateKeyPath: sshKey,
                    user: sshUser
                }
            },
            configuration: {}
        }
    }

    /**
     * Prompt provider-specific input using known common Input and passed default input
     */
    protected abstract promptSpecificInput(defaultInput: CommonInstanceInput & PartialDeep<I>): Promise<I>

    /**
     * Transform CLI arguments into known Input interface
     */
    abstract cliArgsIntoInput(cliArgs: A): PartialDeep<I>

    async completeCliInput(cliArgs: A): Promise<I> {
        const partialInput = this.cliArgsIntoInput(cliArgs)
        const input = await this.promptInput(partialInput)
        return input
    }

    protected async instanceName(_instanceName?: string): Promise<string> {
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

    protected async privateSshKey(privateSshKey?: string): Promise<string> {
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

    protected async useSpotInstance(useSpot?: boolean): Promise<boolean>{
        if (useSpot) {
            return useSpot;
        }

        const useSpotChoice = await confirm({
            message: `Do you want to use spot instances ? Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.`,
            default: true,
        })
    
        return useSpotChoice;
    }

    protected async publicIpType(publicIpType?: PUBLIC_IP_TYPE): Promise<PUBLIC_IP_TYPE> {
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