import * as fs from 'fs';
import * as path from 'path';
import { CLOUDYPAD_INSTANCES_DIR, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { StateManager, StateUtils } from './state';
import { InstanceRunner } from './runner';
import { AwsInstanceRunner } from '../providers/aws/runner';
import { InstanceProvisioner } from './provisioner';
import { AwsProvisioner } from '../providers/aws/provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { PaperspaceInstanceRunner } from '../providers/paperspace/runner';
import { PaperspaceProvisioner } from '../providers/paperspace/provisioner';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { GenericInitializationArgs, InstanceInitializer } from './initializer';
import { AwsInstanceInitializer } from '../providers/aws/initializer';
import { PaperspaceInstanceInitializer } from '../providers/paperspace/initializer';
import { select } from '@inquirer/prompts';

/**
 * Utility class to manage instances globally. Instance state
 * are saved under CLOUDYPAD_INSTANCES_DIR, this class function
 * allow to manipulate the content of this directory. 
 */
export class GlobalInstanceManager {

    private static readonly logger = getLogger(GlobalInstanceManager.name)

    private constructor() {}

    static getAllInstances(): string[] {
        
        try {
            this.logger.debug(`Listing all instances from ${CLOUDYPAD_INSTANCES_DIR}`)

            const instanceDir = fs.readdirSync(CLOUDYPAD_INSTANCES_DIR);

            return instanceDir.filter(dir => fs.existsSync(path.join(CLOUDYPAD_INSTANCES_DIR, dir, 'config.yml')));
        } catch (error) {
            this.logger.error('Failed to read instances directory:', error);
            return [];
        }
    }

    /**
     * Let user select a provider and return the related InstanceInitializer object
     * @param args 
     * @returns 
     */
    static async promptInstanceInitializer(args?: GenericInitializationArgs): Promise<InstanceInitializer>{

        return await select<InstanceInitializer>({
            message: 'Select Cloud provide:',
            choices: [
                { name: CLOUDYPAD_PROVIDER_AWS, value: new AwsInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_PAPERSPACE, value: new PaperspaceInstanceInitializer(args) }
            ]
        })
    }

    static async getInstanceManager(instanceName: string){
        const sm = await StateUtils.loadInstanceState(instanceName)
        return new InstanceManager(sm)
    }
}

/**
 * Manage an instance. Delegate specifities to sub-manager:
 * - InstanceRunner for managing instance running status (stopping, starting, etc)
 * - InstanceProvisioner to manage Cloud resources
 * - InstanceConfigurator to manage instance OS and system packages
 */
export class InstanceManager {

    protected readonly logger
    private sm: StateManager

    constructor(sm: StateManager){
        this.sm = sm
        this.logger = getLogger(sm.name())
    }

    isProvisioned(): boolean{
        return this.sm.get().status.initalized && this.sm.get().status.provision.provisioned
    }

    isConfigured(): boolean{
        return this.sm.get().status.initalized && this.sm.get().status.configuration.configured
    }

    private getCurrentProviderName(): string {
        const state = this.sm.get()
        if(state.provider?.aws){
            return CLOUDYPAD_PROVIDER_AWS
        } else if (state.provider?.paperspace){
            return CLOUDYPAD_PROVIDER_PAPERSPACE
        } else {
            throw new Error(`Unknown provider in state: ${state}`)
        }
    }
    
    async getInstanceRunner(): Promise<InstanceRunner>{
        const provider = this.getCurrentProviderName()
        if(provider === CLOUDYPAD_PROVIDER_AWS){
            return new AwsInstanceRunner(this.sm)
        } else if (provider === CLOUDYPAD_PROVIDER_PAPERSPACE){
            return new PaperspaceInstanceRunner(this.sm)
        } else {
            throw new Error(`Unknown provider: ${provider}`)
        }
    }
    
    async getInstanceProvisioner(): Promise<InstanceProvisioner> {
        const provider = this.getCurrentProviderName()
        if(provider === CLOUDYPAD_PROVIDER_AWS){
            return new AwsProvisioner(this.sm)
        } else if (provider === CLOUDYPAD_PROVIDER_PAPERSPACE){
            return new PaperspaceProvisioner(this.sm)
        } else {
            throw new Error(`Unknown provider: ${provider}`)
        }
    }
    
    async getInstanceConfigurator(): Promise<InstanceConfigurator> {
        return new AnsibleConfigurator(this.sm)
    }

    async destroyInstance(){
        const state = this.sm.get()
        
        this.logger.debug(`Destroying instance ${state.name}`)

        if(state.status.provision.provisioned){
            throw new Error(`Can't destroy instance ${state.name} as it's still provisioned. This is probably an internal bug.`)
        }

        const confDir = StateUtils.getInstanceDir(state.name)

        this.logger.debug(`Removing instance config directory ${state.name}: '${confDir}'`)

        fs.rmSync(confDir, { recursive: true })
    }
}