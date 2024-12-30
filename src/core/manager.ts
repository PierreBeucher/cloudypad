import { InstanceStateV1 } from './state/state';
import { InstanceProvisioner, InstanceProvisionOptions } from './provisioner';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { InstanceRunner } from './runner';
import { StateWriter } from './state/writer';
import { AnsibleConfigurator } from '../configurators/ansible';

/**
 * Used by InstanceManager to build sub-managers
 */
export interface SubManagerFactory<ST extends InstanceStateV1> {
    buildProvisioner(state: ST): Promise<InstanceProvisioner>
    buildRunner(state: ST): Promise<InstanceRunner>
    buildConfigurator(state: ST): Promise<InstanceConfigurator>
}

export abstract class AbstractSubManagerFactory<ST extends InstanceStateV1> {

    async buildProvisioner(state: ST): Promise<InstanceProvisioner> {
        return this.doBuildProvisioner(state.name, state.provision.input, state.provision.output)
    }

    protected abstract doBuildProvisioner(
        name: string, 
        input: ST["provision"]["input"], 
        output: ST["provision"]["output"]
    ): Promise<InstanceProvisioner>
    
    async buildRunner(state: ST): Promise<InstanceRunner> {
        if(!state.provision.output){
            throw new Error(`Can't build Instance Runner for ${state.name}: no provision output in state. Was instance fully provisioned ?`)
        }

        return this.doBuildRunner(state.name, state.provision.input, state.provision.output)
    }

    protected abstract doBuildRunner(
        name: string, 
        input: ST["provision"]["input"], 
        output: NonNullable<ST["provision"]["output"]>
    ): Promise<InstanceRunner>
    
    async buildConfigurator(state: ST): Promise<InstanceConfigurator> {

        if(!state.provision.output) {
            throw new Error("Missing common provision output. Was instance fully initialized ?")
        }

        return this.doBuildConfigurator(
            state.name, 
            state.provision.input, 
            state.provision.output,
            state.configuration.input
        )
    }

    protected async doBuildConfigurator(
        name: string,
        provisionInput: ST["provision"]["input"],
        provisionOutput: NonNullable<ST["provision"]["output"]>,
        configurationInput: ST["configuration"]["input"]
    ): Promise<InstanceConfigurator> {

        const configurator = new AnsibleConfigurator<ST>({
            instanceName: name,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput,
            additionalAnsibleArgs: ['-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\''] //TODO only on first run
        })

        return configurator
    }
}

export interface InstanceManager {
    configure(): Promise<void>
    provision(opts?: InstanceProvisionOptions): Promise<void>
    destroy(opts?: InstanceProvisionOptions): Promise<void>
    start(): Promise<void>
    stop(): Promise<void>
    restart(): Promise<void>
    pair(): Promise<void>
    getStateJSON(): string
}

export interface InstanceManagerArgs<ST extends InstanceStateV1> {
    stateWriter: StateWriter<ST>
    factory: SubManagerFactory<ST>
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
export class GenericInstanceManager<ST extends InstanceStateV1> implements InstanceManager {

    protected readonly logger
    protected readonly stateWriter: StateWriter<ST>
    protected readonly factory: SubManagerFactory<ST>

    constructor(args: InstanceManagerArgs<ST>){
        this.stateWriter = args.stateWriter
        this.factory = args.factory
        this.logger = getLogger(args.stateWriter.instanceName())
    }

    async configure(): Promise<void> {
        const configurator = await this.buildConfigurator()
        const output = await configurator.configure()
        this.stateWriter.setConfigurationOutput(output)
    }

    async provision(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildProvisioner()
        const output = await provisioner.provision(opts)
        this.stateWriter.setProvisionOutput(output)
    }

    async destroy(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildProvisioner()
        await provisioner.destroy(opts)
        this.stateWriter.setProvisionOutput(undefined)
        this.stateWriter.destroyInstanceStateDirectory()
    }

    async start(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.start()
    }

    async stop(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.stop()
    }

    async restart(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.restart()
    }

    async pair(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.pair()
    }
    
    private async buildRunner(){
        return this.factory.buildRunner(this.stateWriter.cloneState())
    }
    
    private async buildConfigurator(){
        return this.factory.buildConfigurator(this.stateWriter.cloneState())
    }
    
    private async buildProvisioner(){
        return this.factory.buildProvisioner(this.stateWriter.cloneState())
    }

    public getStateJSON(){
        return JSON.stringify(this.stateWriter.cloneState(), null, 2)
    }
}