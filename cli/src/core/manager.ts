import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'
import { CLOUDYPAD_INSTANCES_DIR, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { InstanceState, StateManager } from './state';
import { InstanceRunner } from './runner';
import { AwsInstanceRunner } from '../providers/aws/runner';
import { InstanceProvisioner } from './provisioner';
import { AwsProvisioner } from '../providers/aws/provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { InstanceInitializer } from './initializer';
import { PaperspaceInstanceRunner } from '../providers/paperspace/runner';
import { PaperspaceProvisioner } from '../providers/paperspace/provisioner';
import { InstanceConfigurator } from './configurator';

export class InstanceManager {
    
    static getAllInstances(): string[] {
        try {
            const instanceDirs = fs.readdirSync(CLOUDYPAD_INSTANCES_DIR);
            return instanceDirs.filter(dir => fs.existsSync(path.join(CLOUDYPAD_INSTANCES_DIR, dir, 'config.yml')));
        } catch (error) {
            console.error('Failed to read instances directory:', error);
            return [];
        }
    }
    
    static async instanceExists(instanceName: string): Promise<boolean>{
        return fs.existsSync(this.getInstanceDir(instanceName))
    }
    
    static getInstanceDir(instanceName: string){
        return path.join(CLOUDYPAD_INSTANCES_DIR, instanceName);
    }
    
    static getInstanceConfigPath(instanceName: string){
        return path.join(this.getInstanceDir(instanceName), "config.yml");
    }

    static async loadInstanceState(instanceName: string): Promise<StateManager>{

        if(!await InstanceManager.instanceExists(instanceName)){
            throw new Error("Instance does not exist.")
        }

        const configPath = InstanceManager.getInstanceConfigPath(instanceName)
        const state = yaml.load(fs.readFileSync(configPath, 'utf8')) as InstanceState; // TODO use Zod
    
        return new StateManager(state)
    }

    static async initializeInstance(defaultState?: Partial<InstanceState>){
        const initializer = new InstanceInitializer()
        await initializer.initializeNew(defaultState)
    }

    static async createInstanceManager(instanceName: string){
        const sm = await InstanceManager.loadInstanceState(instanceName)
        return new InstanceManager(sm)
    }

    private sm: StateManager

    private constructor(sm: StateManager){
        this.sm = sm
    }

    isProvisioned(): boolean{
        return this.sm.get().status.initalized &&this.sm.get().status.provision.provisioned
    }

    isConfigured(): boolean{
        return this.sm.get().status.initalized &&this.sm.get().status.configuration.configured
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
        if(state.status.provision.provisioned){
            throw new Error(`Can't destroy instance ${state.name} as it's still provisioned. This is probably an internal bug.`)
        }

        const confDir = InstanceManager.getInstanceDir(state.name)
        fs.rmSync(confDir, { recursive: true })
    }
}