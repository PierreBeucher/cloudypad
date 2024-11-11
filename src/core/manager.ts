import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'
import { CLOUDYPAD_INSTANCES_DIR, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { InstanceStateV1, StateUtils } from './state';
import { AbstractInstanceRunnerArgs, InstanceRunner } from './runner';
import { AwsInstanceRunner } from '../providers/aws/runner';
import { InstanceProvisioner, InstanceProvisionOptions } from './provisioner';
import { AwsProvisioner } from '../providers/aws/provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { CommonInitConfig, InstanceInitializer } from './initializer';
import { AwsInstanceInitializer } from '../providers/aws/initializer';
import { PaperspaceInstanceInitializer } from '../providers/paperspace/initializer';
import { select } from '@inquirer/prompts';
import { AzureInstanceInitializer } from '../providers/azure/initializer';
import { GcpInstanceInitializer } from '../providers/gcp/initializer';
import { PartialDeep } from 'type-fest';

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
    static async promptInstanceInitializer(args?: PartialDeep<CommonInitConfig>): Promise<InstanceInitializer>{

        return await select<InstanceInitializer>({
            message: 'Select Cloud provider:',
            choices: [
                { name: CLOUDYPAD_PROVIDER_AWS, value: new AwsInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_PAPERSPACE, value: new PaperspaceInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_AZURE, value: new AzureInstanceInitializer(args) },
                { name: CLOUDYPAD_PROVIDER_GCP, value: new GcpInstanceInitializer(args)}
            ]
        })
    }
}

/**
 * Manage an instance. Delegate specifities to sub-manager:
 * - InstanceRunner for managing instance running status (stopping, starting, etc)
 * - InstanceProvisioner to manage Cloud resources
 * - InstanceConfigurator to manage instance OS and system packages
 * 
 * Also manages state update and persistence on disk. 
 */
export class InstanceManager implements InstanceRunner, InstanceProvisioner, InstanceConfigurator {

    static async get(instanceName: string){
        const state = await StateUtils.loadInstanceState(instanceName)
        return new InstanceManager(state)
    }

    protected readonly logger
    private readonly state: InstanceStateV1

    constructor(state: InstanceStateV1){
        this.state = state
        this.logger = getLogger(state.name)
    }

    async configure(): Promise<void> {
        const configurator = await this.buildInstanceConfigurator()
        await configurator.configure()
        await this.persistState()
    }

    async provision(opts?: InstanceProvisionOptions): Promise<void> {
        const provisioner = await this.buildInstanceProvisioner()
        await provisioner.provision(opts)
        await this.persistState()
    }

    async destroy(opts?: InstanceProvisionOptions): Promise<void> {
        // Remove infrastructure with provisioner
        const provisioner = await this.buildInstanceProvisioner()
        await provisioner.destroy(opts)
        await this.persistState()

        // Remove state on disk
        const confDir = StateUtils.getInstanceDir(this.state.name)

        this.logger.debug(`Removing instance config directory ${this.state.name}: '${confDir}'`)

        fs.rmSync(confDir, { recursive: true })
    }

    async start(): Promise<void> {
        const runner = await this.buildInstanceRunner()
        await runner.start()
        await this.persistState()
    }

    async stop(): Promise<void> {
        const runner = await this.buildInstanceRunner()
        await runner.stop()
        await this.persistState()
    }

    async restart(): Promise<void> {
        const runner = await this.buildInstanceRunner()
        await runner.restart()
        await this.persistState()
    }

    async pair(): Promise<void> {
        const runner = await this.buildInstanceRunner()
        await runner.pair()
        await this.persistState()
    }
    
    private async buildInstanceRunner(): Promise<InstanceRunner>{
        const provider = this.getCurrentProviderName()

        if(!this.state.provision.common.output) {
            throw new Error("Missing common state. Was instance fully initialized ?")
        }

        const commonRunnerArgs: AbstractInstanceRunnerArgs = {
            instanceName: this.state.name,
            commonConfig: this.state.provision.common.config,
            commonOutput: this.state.provision.common.output,
        }

        if(provider === CLOUDYPAD_PROVIDER_AWS){
            if(!this.state.provision.aws || !this.state.provision.aws.output) {
                throw new Error("Missing AWS provision state or output. Was instance fully provisioned ?")
            }

            return new AwsInstanceRunner({
                ...commonRunnerArgs,
                awsConfig: this.state.provision.aws.config,
                awsOutput: this.state.provision.aws.output,
            })

        // } else if (provider === CLOUDYPAD_PROVIDER_PAPERSPACE){
        //     return new PaperspaceInstanceRunner(this.sm)
        // } else if (provider === CLOUDYPAD_PROVIDER_AZURE){
        //     return new AzureInstanceRunner(this.sm)
        // } else if (provider === CLOUDYPAD_PROVIDER_GCP){
        //     return new GcpInstanceRunner(this.sm)
        } else {
            throw new Error(`Unknown provider: ${provider}`)
        }
    }
    
    private async buildInstanceProvisioner(): Promise<InstanceProvisioner> {
        const provider = this.getCurrentProviderName()

        const commonProvisionerArgs = {
            instanceName: this.state.name,
            common: this.state.provision.common,
        }

        if(provider === CLOUDYPAD_PROVIDER_AWS){

            if(!this.state.provision.aws) {
                throw new Error("Missing AWS provision state. Was instance fully initialized ?")
            }

            return new AwsProvisioner({
                ...commonProvisionerArgs, 
                aws: this.state.provision.aws,
            })

        // } else if (provider === CLOUDYPAD_PROVIDER_PAPERSPACE){
        //     return new PaperspaceProvisioner(this.sm)
        // } else if (provider === CLOUDYPAD_PROVIDER_AZURE){
        //     return new AzureProvisioner(this.sm)
        // } else if (provider === CLOUDYPAD_PROVIDER_GCP){
        //     return new GcpProvisioner(this.sm)
        } else {
            throw new Error(`Unknown provider: ${provider}`)
        }
    }
    
    private async buildInstanceConfigurator(): Promise<InstanceConfigurator> {

        if(!this.state.provision.common.output) {
            throw new Error("Missing common provision output. Was instance fully initialized ?")
        }

        return new AnsibleConfigurator({
            instanceName: this.state.name,
            commonConfig: this.state.provision.common.config,
            commonOutput: this.state.provision.common.output,
            additionalAnsibleArgs: ['-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\''] //TODO only on first run
        })
    }

    private getCurrentProviderName(): string {
        return this.state.provision.provider
    }

    /**
     * Persist current state on disk.
     * This function is called after every action where eventual state update occured. 
     */
    async persistState(){
    
        const confPath = StateUtils.getInstanceConfigPath(this.state.name)

        this.logger.debug(`Persisting state for ${this.state.name} at ${confPath}`)

        fs.writeFileSync(confPath, yaml.dump(this.state), 'utf-8')
    }

    public getState(){
        return this.state
    }
}