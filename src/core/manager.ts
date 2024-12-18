import { InstanceStateV1 } from './state/state';
import { InstanceProvisioner, InstanceProvisionOptions } from './provisioner';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { InstanceRunner } from './runner';
import { StateManager } from './state/manager';
import { AnsibleConfigurator } from '../configurators/ansible';

/**
 * Used by InstanceManager to build sub-managers
 */
export interface SubManagerFactory {
    buildProvisioner(state: InstanceStateV1): Promise<InstanceProvisioner>
    buildRunner(state: InstanceStateV1): Promise<InstanceRunner>
    buildConfigurator(state: InstanceStateV1): Promise<InstanceConfigurator>
}

export abstract class AbstractSubManagerFactory<StateType extends InstanceStateV1> {

    async buildProvisioner(state: StateType): Promise<InstanceProvisioner> {
        return this.doBuildProvisioner(state.name, state.provision.config, state.provision.output)
    }

    protected abstract doBuildProvisioner(
        name: string, 
        config: StateType["provision"]["config"], 
        output: StateType["provision"]["output"]
    ): Promise<InstanceProvisioner>
    
    async buildRunner(state: StateType): Promise<InstanceRunner> {
        if(!state.provision.output){
            throw new Error(`Can't build Instance Runner for ${state.name}: no provision output in state. Was instance fully provisioned ?`)
        }

        return this.doBuildRunner(state.name, state.provision.config, state.provision.output)
    }

    protected abstract doBuildRunner(
        name: string, 
        config: StateType["provision"]["config"], 
        output: NonNullable<StateType["provision"]["output"]>
    ): Promise<InstanceRunner>
    
    async buildConfigurator(state: StateType): Promise<InstanceConfigurator> {

        if(!state.provision.output) {
            throw new Error("Missing common provision output. Was instance fully initialized ?")
        }

        return this.doBuildConfigurator(state.name, state.provision.config, state.provision.output)
    }

    protected async doBuildConfigurator(
        name: string,
        config: StateType["provision"]["config"],
        output: NonNullable<StateType["provision"]["output"]>
    ): Promise<InstanceConfigurator> {

        return new AnsibleConfigurator({
            instanceName: name,
            commonConfig: config,
            commonOutput: output,
            additionalAnsibleArgs: ['-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\''] //TODO only on first run
        })
    }
}

export interface InstanceManagerArgs {
    state: InstanceStateV1
    factory: SubManagerFactory
}
/**
 * Manage an instance. Delegate specifities to sub-manager:
 * - InstanceRunner for managing instance running status (stopping, starting, etc)
 * - InstanceProvisioner to manage Cloud resources
 * - InstanceConfigurator to manage instance OS and system packages
 * 
 * Also manages instance state update and persistence on disk. After each operation where instance state
 * potentially change, it is persisted on disk. 
 * 
 * The concrete instance type is not known by this class: a per-provider factory is used 
 * to build each sub-managers.
 */
export class InstanceManager {

    protected readonly logger
    protected readonly state: InstanceStateV1
    protected readonly factory: SubManagerFactory

    constructor(args: InstanceManagerArgs){
        this.state = args.state
        this.factory = args.factory
        this.logger = getLogger(args.state.name)
    }

    async configure(): Promise<void> {
        const configurator = await this.buildConfigurator()
        await configurator.configure()
        await this.persistState()
    }

    async provision(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildProvisioner()
        const output = await provisioner.provision(opts)
        this.state.provision.output = output
        await this.persistState()
    }

    async destroy(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildProvisioner()
        await provisioner.destroy(opts)
        this.state.provision.output = undefined
        await this.persistState()
        await StateManager.default().removeInstanceDir(this.state.name)
    }

    async start(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.start()
        await this.persistState()
    }

    async stop(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.stop()
        await this.persistState()
    }

    async restart(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.restart()
        await this.persistState()
    }

    async pair(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.pair()
        await this.persistState()
    }
    
    private async buildRunner(){
        return this.factory.buildRunner(this.state)
    }
    
    private async buildConfigurator(){
        return this.factory.buildConfigurator(this.state)
    }
    
    private async buildProvisioner(){
        return this.factory.buildProvisioner(this.state)
    }

    /**
     * Persist current state on disk.
     * This function is called after every action where eventual state update occured. 
     */
    async persistState(){
        StateManager.default().persistState(this.state)
    }

    public getStateJSON(){
        return JSON.stringify(this.state, null, 2)
    }
}