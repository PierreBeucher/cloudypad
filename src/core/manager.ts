import { CommonInstanceInput, InstanceEvent, InstanceEventEnum, InstanceStateV1 } from './state/state';
import { InstanceProvisioner } from './provisioner';
import { InstanceConfigurator } from './configurator';
import { getLogger } from '../log/utils';
import { InstanceRunner, ServerRunningStatus, StartStopOptions } from './runner';
import { StateWriter } from './state/writer';
import { ConfiguratorFactory } from './submanager-factory';
import { ProvisionerFactory } from './submanager-factory';
import { RunnerFactory } from './submanager-factory';
import { AnsibleConfiguratorOptions } from '../configurators/ansible';

/**
 * Instance details suitable for end users, hiding or simplyfing internal details
 */
export interface CloudyPadInstanceDetails {
    /**
     * instance name
     */
    name: string

    /**
     * Public hostname (IP or address)
     */
    hostname: string

    /**
     * Moonlight pairing port
     */
    pairingPort: number

    /**
     * SSH config
     */
    ssh: {
        user: string
        port: number
    }
}

export interface InstanceStatus {

    /**
     * Instance running status
     */
    serverStatus: ServerRunningStatus

    /**
     * True if instance has been provisioned at least once
     */
    provisioned: boolean

    /**
     * True if instance has been configured at least once
     */
    configured: boolean

    /**
     * True if instance is ready to use and accept user connections
     */
    ready: boolean
}

/**
 * Main operation interface for an instance to start/stop/restart and run various operations.
 */
export interface InstanceManager {
    name(): string
    configure(): Promise<void>
    provision(): Promise<void>
    deploy(): Promise<void>
    destroy(): Promise<void>
    start(opts?: StartStopOptions): Promise<void>
    stop(opts?: StartStopOptions): Promise<void>
    restart(opts?: StartStopOptions): Promise<void>
    pairInteractive(): Promise<void>
    pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean>

    /**
     * Returns all events of the instance
     */
    getEvents(): Promise<InstanceEvent[]> 

    /**
     * Returns the latest event of the instance
     */
    getLatestEvent(): Promise<InstanceEvent | undefined>

    /**
     * Returns the instance details: hostname, pairing port, ssh config...
     */
    getInstanceDetails(): Promise<CloudyPadInstanceDetails>

    /**
     * Returns detailed status of the instance: configurationd details, running status, provisioned, configured and readiness
     */
    getInstanceStatus(): Promise<InstanceStatus>

    /**
     * Returns the current internal state of the instance
     */
    getState(): Promise<InstanceStateV1>

    /**
     * Returns the current inputs of the instance
     */
    getInputs(): Promise<CommonInstanceInput>

    /**
     * Check if instance has been fully configured at least onece after initialization. 
     */
    isConfigured(): Promise<boolean>

    /**
     * Check if instance has been fully provisioned at least onece after initialization.
     */
    isProvisioned(): Promise<boolean>

    /**
     * Check if instance is ready to use and accept user connections.
     * Instance needs to be fully provisioned and configured, started 
     * and streaming server running and ready to accept connections.
     */
    isReady(): Promise<boolean>
}

export interface GenericInstanceManagerArgs<ST extends InstanceStateV1> {
    
    stateWriter: StateWriter<ST>

    /**
     * Factory to build runners
     */
    runnerFactory: RunnerFactory<ST>

    /**
     * Factory to build provisioners
     */
    provisionerFactory: ProvisionerFactory<ST>

    /**
     * Factory to build configurators
     */
    configuratorFactory: ConfiguratorFactory<ST, AnsibleConfiguratorOptions>

    options?: {

        /**
         * Delete instance server on instance stop configuration.
         * 
         * If enabled, will cause instance server (and its associated disks) to be deleted on instance stop using Provisioner.
         * On next start, instance will be re-provisioned and re-configured with a fresh instance server. 
         * 
         * This options should be enabled when: 
         * - Both OS root disk and data disk are set to avoid data loss. If data disk is not set, 
         *   game data held on instance server will be deleted on instance stop.
         * - Instance is configured to use a pre-provisioned Image as OS root disk to avoid long starting time
         *   as each start will run provision and configuration.
         */
        deleteInstanceServerOnStop?: {

            /**
             * Enable instance deletion on stop.
             */
            enabled: boolean,

            /**
             * Additional Ansible arguments to pass to after-start reconfiguration.
             * These flags are specific to post-start reconfiguration to avoid re-running
             * full configuration on every start and should be tailored to specific provider needs
             * to ensure faster start while preserving functionality.
             * 
             * Ansible configuration args from CLI or state are ignored during post-start reconfiguration.
             */
            postStartReconfigurationAnsibleAdditionalArgs?: string[]
        }
    }
}

/**
 * Ansible additional arguments always passed to configurator.
 * Always skip host key checking as we don't have a known host key for the instance since it's defined randomly
 * and can't be known in advance. 
 */
const ALWAYS_ANSIBLE_ADDITIONAL_ARGS = ['-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\'']

/**
 * Manage an instance. Delegate specifities to sub-manager:
 * - InstanceProvisioner to manage Cloud resources
 * - an Ansible InstanceConfigurator to manage instance OS and system packages
 * - InstanceRunner for managing instance running status (stopping, starting, etc)
 * 
 * Responsible for state updates:
 * - Outputs are set on state after related operations
 * - Events are added on state after related operations
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
    protected readonly runnerFactory: RunnerFactory<ST>
    protected readonly provisionerFactory: ProvisionerFactory<ST>
    protected readonly configuratorFactory: ConfiguratorFactory<ST, AnsibleConfiguratorOptions>

    protected readonly args: GenericInstanceManagerArgs<ST>

    constructor(args: GenericInstanceManagerArgs<ST>){
        this.stateWriter = args.stateWriter
        this.runnerFactory = args.runnerFactory
        this.provisionerFactory = args.provisionerFactory
        this.configuratorFactory = args.configuratorFactory
        this.args = args
        this.logger = getLogger(args.stateWriter.instanceName())
    }

    name(): string {
        return this.stateWriter.instanceName()
    }

    async configure(): Promise<void> {

        this.logger.debug(`Configuring instance ${this.name()}`)

        const currentState = await this.getState()
        const configurationAnsibleAdditionalArgs = currentState.configuration.input.ansible?.additionalArgs ? 
            [currentState.configuration.input.ansible.additionalArgs] : undefined

        await this.addEvent(InstanceEventEnum.ConfigurationBegin)
        await this.doConfigure(configurationAnsibleAdditionalArgs)
        await this.addEvent(InstanceEventEnum.ConfigurationEnd)
    }

    async provision() {
        await this.addEvent(InstanceEventEnum.ProvisionBegin)
        await this.doProvision()
        await this.addEvent(InstanceEventEnum.ProvisionEnd)
    }

    async deploy() {
        await this.provision()
        await this.configure()
    }

    async destroy() {
        this.logger.debug(`Destroying instance ${this.name()}`)

        const provisioner = await this.buildProvisioner()

        await this.stateWriter.addEvent(InstanceEventEnum.DestroyBegin)
        await provisioner.destroy()

        await this.stateWriter.setProvisionOutput(undefined)
        await this.stateWriter.setConfigurationOutput(undefined)
        await this.stateWriter.addEvent(InstanceEventEnum.DestroyEnd)

        await this.stateWriter.destroyState()
    }

    async start(startOpts?: StartStopOptions): Promise<void> {

        await this.addEvent(InstanceEventEnum.StartBegin)

        // if deleteInstanceServerOnStop is enabled, instance server may have been deleted on last instance stop
        // so we need to re-provision and re-configure instance using specific Ansible args
        if(this.args.options?.deleteInstanceServerOnStop?.enabled){
            await this.doProvision()
            await this.doConfigure(this.args.options.deleteInstanceServerOnStop.postStartReconfigurationAnsibleAdditionalArgs)
        }

        // always start instance as provisioning and configuring may not start the server for all providers
        // and startOptions logic is ported by runner
        const runner = await this.buildRunner()
        await runner.start(startOpts)

        await this.addEvent(InstanceEventEnum.StartEnd)
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        
        await this.addEvent(InstanceEventEnum.StopBegin)

        // always cleanly stop instance to avoid data inconsistency 
        // as instance server may be deleted on stop and deleting without stopping may cause data inconsistency
        // and stopOptions logic is ported by runner
        const runner = await this.buildRunner()
        await runner.stop(opts)

        // destroy instance server if deleteInstanceServerOnStop is enabled
        // only stop instance if deleteInstanceServerOnStop is not enabled
        // no sense in stopping instance if it's deleted right away
        if(this.args.options?.deleteInstanceServerOnStop?.enabled){
            await this.doDestroyInstanceServer()
        }

        await this.addEvent(InstanceEventEnum.StopEnd)
    }

    /**
     * Restart instance. 
     * 
     * Ignores deleteInstanceServerOnStop since instance is not stopped but restarted. 
     * 
     * @param opts 
     */
    async restart(opts?: StartStopOptions): Promise<void> {
        await this.addEvent(InstanceEventEnum.RestartBegin)
        const runner = await this.buildRunner()
        await runner.restart(opts)
        await this.addEvent(InstanceEventEnum.RestartEnd)
    }

    async pairInteractive(): Promise<void> {
        const runner = await this.buildRunner()
        await runner.pairInteractive()
    }

    async pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean> {
        const runner = await this.buildRunner()
        return runner.pairSendPin(pin, retries, retryDelay)
    }

    //
    // Private methods to run provision/configuration and update state
    //

    /**
     * Destroy instance server using provisioner and update state with provision output.
     * Reset configuration output to undefined.
     */
    private async doDestroyInstanceServer(): Promise<void> {
        const provisioner = await this.buildProvisioner()
        const newOutputs = await provisioner.destroyInstanceServer()
        await this.stateWriter.setProvisionOutput(newOutputs)
        await this.stateWriter.setConfigurationOutput(undefined)
    }

    /**
     * Configure instance using Ansible configurator and update state with configuration output.
     * Decorellated from mainn configure() method as it may be run for configuration and as post-start reconfiguration by start().
     */
    private async doConfigure(additionalAnsibleArgs?: string[]): Promise<void> {

        this.logger.debug(`Do configure instance ${this.name()} with additional Ansible args: ${JSON.stringify(additionalAnsibleArgs)}`)
        const configurator = await this.buildConfigurator({
            additionalAnsibleArgs: ALWAYS_ANSIBLE_ADDITIONAL_ARGS.concat(additionalAnsibleArgs ?? [])
        })
        const output = await configurator.configure()
        
        this.logger.debug(`Configuration output for instance ${this.name()}: ${JSON.stringify(output)}`)

        await this.stateWriter.setConfigurationOutput(output)
    }
    
    /**
     * Provision instance using provisioner and update state with provision output.
     * Decorellated from main provision() method as it may be run for configuration and as post-start reconfiguration by start().
     */
    private async doProvision(): Promise<void> {

        this.logger.debug(`Provisioning instance ${this.name()}`)

        const provisioner = await this.buildProvisioner()
        const newOutputs = await provisioner.provision()

        this.logger.debug(`Provision output for instance ${this.name()}: ${JSON.stringify(newOutputs)}`)

        await this.stateWriter.setProvisionOutput(newOutputs)
    }

    private async buildRunner(): Promise<InstanceRunner> {
        return this.runnerFactory.buildRunner(this.stateWriter.cloneState())
    }
    
    private async buildConfigurator(configuratorOptions?: AnsibleConfiguratorOptions): Promise<InstanceConfigurator> {
        return this.configuratorFactory.buildConfigurator(this.stateWriter.cloneState(), configuratorOptions)
    }
    
    private async buildProvisioner(): Promise<InstanceProvisioner> {
        return this.provisionerFactory.buildProvisioner(this.stateWriter.cloneState())
    }

    private async addEvent(event: InstanceEventEnum): Promise<void> {
        await this.stateWriter.addEvent(event)
    }

    //
    // Public methods to get instance info
    //

    public async getEvents(): Promise<InstanceEvent[]> {
        const state = this.stateWriter.cloneState()
        return state.events ?? []
    }

    public async getLatestEvent(): Promise<InstanceEvent | undefined> {
        const events = await this.getEvents()
        events.sort((a, b) => a.timestamp - b.timestamp)
        return events.length > 0 ? events[events.length - 1] : undefined
    }

    public async getInstanceDetails(): Promise<CloudyPadInstanceDetails> {
        const runner = await this.buildRunner()
        const state = this.stateWriter.cloneState()
        const details: CloudyPadInstanceDetails = {
            name: state.name,
            hostname: state.provision.output?.host ?? "unknown",
            pairingPort: 47989, // hardcoded for now
            ssh: {
                user: state.provision.input.ssh.user,
                port: 22 // TODO as input or output
            }
        }

        return details
    }

    public async getInstanceStatus(): Promise<InstanceStatus> {
        let serverStatus: ServerRunningStatus = ServerRunningStatus.Unknown
        if(await this.isProvisioned()){
            const runner = await this.buildRunner()
            serverStatus = await runner.serverStatus()
        }

        const details: InstanceStatus = {
            serverStatus: serverStatus,
            provisioned: await this.isProvisioned(),
            configured: await this.isConfigured(),
            ready: await this.isReady(),
        }

        return details
    }

    public async getState(): Promise<ST> {
        return this.stateWriter.cloneState()
    }

    async getInputs(): Promise<CommonInstanceInput> {
        const state = this.stateWriter.cloneState()
        return {
            instanceName: state.name,
            provision: state.provision.input,
            configuration: state.configuration.input
        }
    }

    async isConfigured(): Promise<boolean> {
        const currentState = this.stateWriter.cloneState()
        return currentState.configuration.output !== undefined
    }

    async isProvisioned(): Promise<boolean> {
        const currentState = this.stateWriter.cloneState()
        return currentState.provision.output !== undefined
    }

    async isReady(): Promise<boolean> {
        const isConfiguredAndProvisioned = await this.isConfigured() && await this.isProvisioned()
        if(!isConfiguredAndProvisioned){
            return false
        }

        // building runner fails if instance is not provisioned
        const runner = await this.buildRunner()
        const streamingServerReady = await runner.isStreamingServerReady()
        return streamingServerReady
    }
}