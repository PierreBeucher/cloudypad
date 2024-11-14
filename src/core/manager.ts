import * as fs from 'fs';
import * as yaml from 'js-yaml'
import { InstanceStateV1, StateUtils } from './state';
import { AbstractInstanceRunnerArgs, InstanceRunner } from './runner';
import { AwsInstanceRunner } from '../providers/aws/runner';
import { InstanceProvisioner, InstanceProvisionOptions } from './provisioner';
import { AwsProvisioner } from '../providers/aws/provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { CLOUDYPAD_PROVIDER_AWS } from './const';

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