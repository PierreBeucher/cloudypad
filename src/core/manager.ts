import * as fs from 'fs';
import * as yaml from 'js-yaml'
import { CommonProvisionConfigV1, CommonProvisionOutputV1, InstanceStateV1, StateUtils } from './state';
import { InstanceProvisioner, InstanceProvisionOptions } from './provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { InstanceRunner } from './runner';

/**
 * Expose main functions to manage an instance lifecycle: init/provision/configure/destroy and start/stop/restart
 * 
 * Ressemble underlying Instance Runner, Provisioner and Configurator except it hides Config and Output type complexity.
 */
export interface InstanceManager { 

    provision(opts?: InstanceProvisionOptions): Promise<void>
    destroy(opts?: InstanceProvisionOptions): Promise<void>

    configure(): Promise<void>

    start(): Promise<void>
    stop(): Promise<void>
    restart(): Promise<void>
    
    pair(): Promise<void>

    persistState(): Promise<void>

    /**
     * Get a raw JSON representation of instance state
     */
    getStateJSON(): string
}

/**
 * Manage an instance. Delegate specifities to sub-manager:
 * - InstanceRunner for managing instance running status (stopping, starting, etc)
 * - InstanceProvisioner to manage Cloud resources
 * - InstanceConfigurator to manage instance OS and system packages
 * 
 * Also manages instance state update and persistence on disk. After each operation where instance state
 * potentially change, it is persisted on disk. 
 */
export abstract class AbstractInstanceManager<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1> implements InstanceManager {

    protected readonly logger
    protected readonly state: InstanceStateV1<C, O>

    constructor(state: InstanceStateV1<C, O>){
        this.state = state
        this.logger = getLogger(state.name)
    }

    async configure(): Promise<void> {
        const configurator = await this.buildInstanceConfigurator()
        await configurator.configure()
        await this.persistState()
    }

    async provision(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildInstanceProvisioner()

        // Provision and update output
        const output = await provisioner.provision(opts)
        this.state.provision.output = output
        
        await this.persistState()
    }

    async destroy(opts?: InstanceProvisionOptions) {
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
    
    protected buildInstanceRunner(): Promise<InstanceRunner> {
        if(!this.state.provision.output){
            throw new Error(`Can't build Instance Runner for ${this.state.name}: no provision output in state. Was instance fully provisioned ?`)
        }

        return this.doBuildInstanceRunnerWith(this.state.provision.output)
    }
    
    protected abstract doBuildInstanceRunnerWith(output: O): Promise<InstanceRunner>

    protected abstract buildInstanceProvisioner(): Promise<InstanceProvisioner<O>>

    private async buildInstanceConfigurator(): Promise<InstanceConfigurator> {

        if(!this.state.provision.output) {
            throw new Error("Missing common provision output. Was instance fully initialized ?")
        }

        return new AnsibleConfigurator({
            instanceName: this.state.name,
            commonConfig: this.state.provision.config,
            commonOutput: this.state.provision.output,
            additionalAnsibleArgs: ['-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\''] //TODO only on first run
        })
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

    public getStateJSON(){
        return JSON.stringify(this.state, null, 2)
    }
}