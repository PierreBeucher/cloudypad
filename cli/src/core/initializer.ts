import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { input, select, confirm } from '@inquirer/prompts';
import { InstanceRunner } from './runner';
import { CLOUDYPAD_PROVIDER, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { AwsProvisioner } from '../providers/aws/provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { AwsInstanceRunner } from '../providers/aws/runner';
import { InstanceProvisioner } from './provisioner';
import { InstanceState, StateManager } from './state';
import { InstanceManager } from './manager';
import { PaperspaceProvisioner } from '../providers/paperspace/provisioner';
import { PaperspaceInstanceRunner } from '../providers/paperspace/runner';
import { PaperspaceInitializerPrompt } from '../providers/paperspace/initializer';
import { AwsInitializerPrompt } from '../providers/aws/initializer';

/**
 * Instance initializer create the initial state of an instance 
 * and pass it through various initialization phases, updating state as it goes:
 * - Initial creation
 * - Provisioning
 * - Configuration
 * - Pairing
 * 
 * Initializer can take arguments directly or will prompt for missing arguments. 
 */
export class InstanceInitializer {

    public async initializeNew(defaultState?: Partial<InstanceState>) {
        const instanceName = await this.instanceName(defaultState?.name)
        console.info(`Initializing instance: ${instanceName}`)

        const privateSshKey = await this.privateSshKey(defaultState?.ssh?.privateKeyPath)
        const providerName = await this.provider()
        
        const initialState: InstanceState = {
            name: instanceName,
            ssh: {
                privateKeyPath: privateSshKey,
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

        const sm = new StateManager(initialState)

        // Create instance directory
        fs.mkdirSync(InstanceManager.getInstanceDir(instanceName), { recursive: true });

        // TODO maybe merge prompt and provider together to prompt if provision args are missing
        // Maybe check for initalized and no provider object on run of provision to dynamically update it ?
        let provider: InstanceProvisioner;
        if (providerName === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            
            const args = await new PaperspaceInitializerPrompt().prompt()
            sm.update({ 
                ssh: {
                    user: "paperspace"
                },
                provider: { paperspace: { provisionArgs: args }}
            })

            provider = new PaperspaceProvisioner(sm)

        } else if (providerName === CLOUDYPAD_PROVIDER_AWS) {
            
            const args = await new AwsInitializerPrompt().prompt()
            sm.update({ 
                ssh: {
                    user: "ubuntu"
                },
                provider: { aws: { provisionArgs: args }}
            })

            provider = new AwsProvisioner(sm)
        } else {
            throw new Error(`Unknown Provider: ${providerName}`)
        }

        await provider.provision()

        const configurator = new AnsibleConfigurator(sm)
        await configurator.configure()

        let runner: InstanceRunner
        if (providerName === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            runner = new PaperspaceInstanceRunner(sm)
        } else if (providerName === CLOUDYPAD_PROVIDER_AWS) {
            runner= new AwsInstanceRunner(sm)
        } else {
            throw new Error(`Unknown Provider: ${providerName}`)
        }

        const doPair = await confirm({
            message: `Your instance is almost ready ! Do you want to pair Moonlight now?`,
            default: true,
        });

        if (doPair) {
            await runner.pair()
        }

        console.info("")
        console.info("Instead has been initialized successfully 🥳")
        console.info("")
        console.info("If you like Cloudy Pad please leave us a star ⭐ https://github.com/PierreBeucher/cloudypad")
        console.info("")
        console.info("🐛 A bug ? Some feedback ? Do not hesitate to file an issue: https://github.com/PierreBeucher/cloudypad/issues")
        
    }

    protected async instanceName(_instanceName?: string): Promise<string> {
        let instanceName: string
        
        if (_instanceName) {
            instanceName = _instanceName
        } else {
            const userInfo = os.userInfo();
            const defaultInstanceName = `${userInfo.username}`;
            instanceName = await input({
                message: 'Enter instance name:',
                default: defaultInstanceName,
            });
        }

        if(await InstanceManager.instanceExists(instanceName)){
            const confirmAlreadyExists = await confirm({
                message: `Instance ${instanceName} already exists. Do you want to overwrite existing instance config?`,
                default: false,
            });
            if (!confirmAlreadyExists) {
                throw new Error("Won't overwrite existing instance. Initialization aborted.")
            }
        }

        return instanceName
    }

    protected async provider(_provider?: CLOUDYPAD_PROVIDER): Promise<CLOUDYPAD_PROVIDER>{
        let provider: CLOUDYPAD_PROVIDER
        if (_provider) {
            provider = _provider;
        } else {
            provider = await select({
                message: 'Select Cloud provider:',
                choices: [
                    { name: CLOUDYPAD_PROVIDER_AWS, value: CLOUDYPAD_PROVIDER_AWS },
                    { name: CLOUDYPAD_PROVIDER_PAPERSPACE, value: CLOUDYPAD_PROVIDER_PAPERSPACE }
                ]
            });
        }

        return provider
    }

    protected async privateSshKey(privateSshKey?: string): Promise<string> {
        if (privateSshKey) {
            return privateSshKey;
        }

        const sshDir = path.join(os.homedir(), '.ssh');
        const sshFiles = fs.readdirSync(sshDir);
        const privateKeys = sshFiles
            .filter(file => file.startsWith('id_') && !file.endsWith('.pub')) // TODO A bit naive method. Maybe we can read all files and check if they are private keys
            .map(file => path.join(sshDir, file));
    
        const sshKeyChoices = privateKeys.map(k => ({
            name: k,
            value: k
        }));
    
        const privateKeyPath = await select({
            message: 'Choose an SSH private key to connect to instance:',
            choices: sshKeyChoices
        });
    
        return privateKeyPath;
    }
}




