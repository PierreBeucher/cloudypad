import { InstanceStateV1 } from './state/state';
import { DestroyOptions, InstanceProvisioner, InstanceProvisionOptions } from './provisioner';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { InstanceRunner, InstanceRunningStatus, StartStopOptions } from './runner';
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
        return this.doBuildProvisioner(state.name, state.provision.input, state.provision.output, state.configuration.input)
    }

    protected abstract doBuildProvisioner(
        name: string, 
        provisionInput: ST["provision"]["input"], 
        provisionOutput: ST["provision"]["output"],
        configurationInput: ST["configuration"]["input"],
    ): Promise<InstanceProvisioner>
    
    async buildRunner(state: ST): Promise<InstanceRunner> {
        if(!state.provision.output){
            throw new Error(`Can't build Instance Runner for ${state.name}: no provision output in state. Was instance fully provisioned ?`)
        }

        return this.doBuildRunner(state.name, state.provision.input, state.provision.output, state.configuration.input)
    }

    protected abstract doBuildRunner(
        name: string, 
        provisionInput: ST["provision"]["input"], 
        provisionOutput: NonNullable<ST["provision"]["output"]>,
        configurationInput: ST["configuration"]["input"],
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
    destroy(opts?: DestroyOptions): Promise<void>
    start(opts?: StartStopOptions): Promise<void>
    stop(opts?: StartStopOptions): Promise<void>
    restart(opts?: StartStopOptions): Promise<void>
    pairInteractive(): Promise<void>
    pairSendPin(pin: string): Promise<boolean>
    getStateJSON(): string
    getInstanceStatus(): Promise<InstanceRunningStatus>
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
        await this.stateWriter.setConfigurationOutput(output)
    }

    async provision(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildProvisioner()
        const output = await provisioner.provision(opts)
        await this.stateWriter.setProvisionOutput(output)
    }

    async destroy(opts?: InstanceProvisionOptions) {
        const provisioner = await this.buildProvisioner()
        await provisioner.destroy(opts)
        await this.stateWriter.setProvisionOutput(undefined)
        await this.stateWriter.destroyInstanceStateDirectory()
    }

    async start(opts?: StartStopOptions): Promise<void> {
        const runner = await this.buildRunner()
        await runner.start(opts)
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        const runner = await this.buildRunner()
        await runner.stop(opts)
    }

    async restart(opts?: StartStopOptions): Promise<void> {
        const runner = await this.buildRunner()
        await runner.restart(opts)
    }

    async pairInteractive(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.pairInteractive()
    }

    async pairSendPin(pin: string): Promise<boolean> {
        const runner = await this.buildRunner()
        return runner.pairSendPin(pin)
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