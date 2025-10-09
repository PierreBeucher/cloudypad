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
import { ActionRetrier } from '../tools/retrier';

const DEFAULT_RETRIES = 1
const DEFAULT_RETRY_DELAY_SECONDS = 10

/**
 * Base options interface for all manager actions
 */
export interface ActionOptions {
    /**
     * Number of retries for the action. Default: 0 (no retry)
     */
    retries?: number

    /**
     * Delay between retries in seconds. Default: 10 seconds
     */
    retryDelaySeconds?: number

    /**
     * Cancel any stuck Pulumi operations before running the action. Default: false
     */
    pulumiCancel?: boolean
}

export interface DeployOptions extends ActionOptions {
}

export interface ConfigureOptions extends ActionOptions {
}

export interface ProvisionOptions extends ActionOptions {
}

export interface StartOptions extends StartStopOptions, ActionOptions {
}

export interface StopOptions extends StartStopOptions, ActionOptions {
}

export interface RestartOptions extends StartStopOptions, ActionOptions {
}

export interface DestroyOptions extends ActionOptions {
}

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
    configure(opts?: ConfigureOptions): Promise<void>
    provision(opts?: ProvisionOptions): Promise<void>
    deploy(opts?: DeployOptions): Promise<void>
    destroy(opts?: DestroyOptions): Promise<void>
    start(opts?: StartOptions): Promise<void>
    stop(opts?: StopOptions): Promise<void>
    restart(opts?: RestartOptions): Promise<void>

    doProvision(): Promise<void>
    doConfigure(additionalAnsibleArgs?: string[]): Promise<void>
    doStart(opts?: StartOptions): Promise<void>
    doStop(opts?: StopOptions): Promise<void>
    doRestart(opts?: RestartOptions): Promise<void>
    doDestroy(opts?: DestroyOptions): Promise<void>

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

    /**
     * Instance name to manage with this manager
     */
    instanceName: string

    /**
     * State writer to manage instance state
     */
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

    public readonly instanceName: string

    constructor(args: GenericInstanceManagerArgs<ST>){
        this.stateWriter = args.stateWriter
        this.runnerFactory = args.runnerFactory
        this.provisionerFactory = args.provisionerFactory
        this.configuratorFactory = args.configuratorFactory
        this.args = args
        this.logger = getLogger(args.instanceName)
        this.instanceName = args.instanceName
    }

    name(): string {
        return this.instanceName
    }

    async configure(opts?: ConfigureOptions): Promise<void> {

        this.logger.debug(`Configuring instance ${this.name()}`)

        const currentState = await this.getState()
        const configurationAnsibleAdditionalArgs = currentState.configuration.input.ansible?.additionalArgs ? 
            [currentState.configuration.input.ansible.additionalArgs] : undefined

        await this.addEvent(InstanceEventEnum.ConfigurationBegin)
        await this.doWithRetry(async () => {
            await this.doConfigure(configurationAnsibleAdditionalArgs)
        }, 'Configuration', opts)
        await this.addEvent(InstanceEventEnum.ConfigurationEnd)
    }

    async provision(opts?: ProvisionOptions): Promise<void> {
        this.logger.debug(`Provisioning instance ${this.name()}`)

        await this.addEvent(InstanceEventEnum.ProvisionBegin)
        await this.doWithRetry(async () => {
            await this.doProvision(opts)
        }, 'Provision', opts)
        await this.addEvent(InstanceEventEnum.ProvisionEnd)
    }

    async deploy(opts?: DeployOptions): Promise<void> {
        await this.provision(opts)
        await this.configure(opts)
    }

    async destroy(opts?: DestroyOptions): Promise<void> {
        this.logger.debug(`Destroying instance ${this.name()}`)

        await this.addEvent(InstanceEventEnum.DestroyBegin)
        await this.doWithRetry(async () => {
            await this.doDestroy()
        }, 'Destroy', opts)
        await this.addEvent(InstanceEventEnum.DestroyEnd)
        await this.stateWriter.destroyState(this.instanceName)
    }

    async start(opts?: StartOptions): Promise<void> {

        this.logger.debug(`Starting instance ${this.name()}`)

        await this.addEvent(InstanceEventEnum.StartBegin)
        await this.doWithRetry(async () => {
            await this.doStart(opts)
        }, 'Start', opts)
        await this.addEvent(InstanceEventEnum.StartEnd)
    }

    async stop(opts?: StopOptions): Promise<void> {
        
        this.logger.debug(`Stopping instance ${this.name()}`)

        await this.addEvent(InstanceEventEnum.StopBegin)
        await this.doWithRetry(async () => {
            await this.doStop(opts)
        }, 'Stop', opts)
        await this.addEvent(InstanceEventEnum.StopEnd)
    }

    /**
     * Restart instance. 
     * 
     * Ignores deleteInstanceServerOnStop since instance is not stopped but restarted. 
     * 
     * @param opts 
     */
    async restart(opts?: RestartOptions): Promise<void> {
        await this.addEvent(InstanceEventEnum.RestartBegin)
        await this.doWithRetry(async () => {
            await this.doRestart(opts)
        }, 'Restart', opts)
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
    async doDestroyInstanceServer(opts?: ActionOptions): Promise<void> {
        const provisioner = await this.buildProvisioner()
        const newOutputs = await provisioner.destroyInstanceServer({
            pulumiCancel: opts?.pulumiCancel
        })
        await this.stateWriter.setProvisionOutput(this.instanceName, newOutputs)
        await this.stateWriter.setConfigurationOutput(this.instanceName, undefined)
    }

    /**
     * Configure instance using Ansible configurator and update state with configuration output.
     * Decorellated from mainn configure() method as it may be run for configuration and as post-start reconfiguration by start().
     */
    async doConfigure(additionalAnsibleArgs?: string[]): Promise<void> {

        this.logger.debug(`Do configure instance ${this.name()} with additional Ansible args: ${JSON.stringify(additionalAnsibleArgs)}`)
        const configurator = await this.buildConfigurator({
            additionalAnsibleArgs: ALWAYS_ANSIBLE_ADDITIONAL_ARGS.concat(additionalAnsibleArgs ?? [])
        })
        const output = await configurator.configure()
        
        this.logger.debug(`Configuration output for instance ${this.name()}: ${JSON.stringify(output)}`)

        await this.stateWriter.setConfigurationOutput(this.instanceName, output)
    }
    
    /**
     * Provision instance using provisioner and update state with provision output.
     * Decorellated from main provision() method as it may be run for configuration and as post-start reconfiguration by start().
     */
    async doProvision(opts?: ActionOptions): Promise<void> {

        this.logger.debug(`Do provision instance ${this.name()}`)

        const provisioner = await this.buildProvisioner()
        const newOutputs = await provisioner.provision({
            pulumiCancel: opts?.pulumiCancel
        })

        this.logger.debug(`Provision output for instance ${this.name()}: ${JSON.stringify(newOutputs)}`)

        await this.stateWriter.setProvisionOutput(this.instanceName, newOutputs)
    }

    /**
     * Start instance using runner.
     */
    async doStart(opts?: StartOptions): Promise<void> {

        // if deleteInstanceServerOnStop is enabled, instance server may have been deleted on last instance stop
        // so we need to re-provision and re-configure instance using specific Ansible args
        if(this.args.options?.deleteInstanceServerOnStop?.enabled){
            await this.doProvision(opts)
            await this.doConfigure(this.args.options.deleteInstanceServerOnStop.postStartReconfigurationAnsibleAdditionalArgs)
        }

        // always start instance as provisioning and configuring may not start the server for all providers
        // and startOptions logic is ported by runner
        const runner = await this.buildRunner()
        await runner.start(opts)
    }

    /**
     * Stop instance using runner.
     */
    async doStop(opts?: StopOptions): Promise<void> {
        const runner = await this.buildRunner()
        
        // if instance server is deleted on stop, check server status first to try and stop it cleanly before deletion
        // skip if server is unknown or can't be found (may happen if previous stop failed or was interrupted)
        // but do call destroyInstanceServer() to ensure instance server and related resources (disks, etc.) are properly deleted or updated
        //
        // if server deletion fails, log error but continue with stop
        //
        // otherwise, stop instance normally
        if(this.args.options?.deleteInstanceServerOnStop?.enabled){
            const serverStatus = await runner.serverStatus()
            if(serverStatus !== ServerRunningStatus.Unknown){

                try {
                    await runner.stop(opts)
                } catch (error) {
                    this.logger.warn(`Failed to stop instance ${this.name()}, continuing with server deletion to finalize stop.`, error)
                }
            } else {
                this.logger.info(`Instance ${this.name()} does not have a server (or server in unknown state). ` + 
                    `Skipping provider API stop and continue with server deletion to finalize stop.`)
            }

            await this.doDestroyInstanceServer(opts)
        } else {
            // don't check server status if no deletion happen on stop as it shouldn't be deleted
            await runner.stop(opts)
        }
    }

    /**
     * Restart instance using runner with retry logic.
     */
    async doRestart(opts?: RestartOptions): Promise<void> {
        const runner = await this.buildRunner()
        await runner.restart(opts)
    }

    async doDestroy(opts?: DestroyOptions): Promise<void> {
        const provisioner = await this.buildProvisioner()
        await provisioner.destroy({
            pulumiCancel: opts?.pulumiCancel
        })
        await this.stateWriter.setProvisionOutput(this.instanceName, undefined)
        await this.stateWriter.setConfigurationOutput(this.instanceName, undefined)
    }

    /**
     * Perform an action with retry logic.
     * @param actionFn Action to perform
     * @param actionName Name of the action to log
     * @param retryOptions Number of retries and delay between retries.
     */
    private async doWithRetry<R>(actionFn: () => Promise<R>, actionName: string, retryOptions?: { retries?: number, retryDelaySeconds?: number }): Promise<R> {
        const retrier = new ActionRetrier({
            actionFn: actionFn,
            actionName: actionName,
            retries: retryOptions?.retries ?? DEFAULT_RETRIES,
            retryDelaySeconds: retryOptions?.retryDelaySeconds ?? DEFAULT_RETRY_DELAY_SECONDS
        })
        return retrier.run()
    }
    
    private async buildRunner(): Promise<InstanceRunner> {
        const state = await this.stateWriter.getCurrentState(this.instanceName)
        return this.runnerFactory.buildRunner(state)
    }
    
    private async buildConfigurator(configuratorOptions?: AnsibleConfiguratorOptions): Promise<InstanceConfigurator> {
        const state = await this.stateWriter.getCurrentState(this.instanceName)
        return this.configuratorFactory.buildConfigurator(state, configuratorOptions)
    }
    
    private async buildProvisioner(): Promise<InstanceProvisioner> {
        const state = await this.stateWriter.getCurrentState(this.instanceName)
        return this.provisionerFactory.buildProvisioner(state)
    }

    private async addEvent(event: InstanceEventEnum): Promise<void> {
        await this.stateWriter.addEvent(this.instanceName, event)
    }

    //
    // Public methods to get instance info
    //

    public async getEvents(): Promise<InstanceEvent[]> {
        const state = await this.stateWriter.getCurrentState(this.instanceName)
        return state.events ?? []
    }

    public async getLatestEvent(): Promise<InstanceEvent | undefined> {
        const events = await this.getEvents()
        events.sort((a, b) => a.timestamp - b.timestamp)
        return events.length > 0 ? events[events.length - 1] : undefined
    }

    public async getInstanceDetails(): Promise<CloudyPadInstanceDetails> {
        const runner = await this.buildRunner()
        const state = await this.stateWriter.getCurrentState(this.instanceName)

        // Handle both key-based and password-based authentication
        let sshUser = "unknown";

        // If using password auth
        if (state.provision.input.auth && 
            typeof state.provision.input.auth === 'object' && 
            'type' in state.provision.input.auth && 
            state.provision.input.auth.type === "password" && 
            'ssh' in state.provision.input.auth && 
            typeof state.provision.input.auth.ssh === 'object' && 
            state.provision.input.auth.ssh && 
            'user' in state.provision.input.auth.ssh) {

            sshUser = (state.provision.input.auth.ssh as any).user;
        }
        // If using key-based auth
        else if (state.provision.input.ssh) {
            sshUser = state.provision.input.ssh.user;
        }

        const details: CloudyPadInstanceDetails = {
            name: state.name,
            hostname: state.provision.output?.host ?? "unknown",
            pairingPort: 47989, // hardcoded for now
            ssh: {
                user: sshUser,
                port: 22 // TODO as input or output
            }
        }

        return details
    }

    public async getInstanceStatus(): Promise<InstanceStatus> { 
        
        this.logger.debug(`Getting instance status for ${this.name()}`)

        let serverStatus: ServerRunningStatus = ServerRunningStatus.Unknown
        if(await this.isProvisioned()){

            this.logger.debug(`Instance ${this.name()} is provisioned. Getting server status from runner...`)

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
        return this.stateWriter.getCurrentState(this.instanceName)
    }

    async getInputs(): Promise<CommonInstanceInput> {
        const state = await this.stateWriter.getCurrentState(this.instanceName)
        return {
            instanceName: state.name,
            provision: state.provision.input,
            configuration: state.configuration.input
        }
    }

    async isConfigured(): Promise<boolean> {
        const currentState = await this.stateWriter.getCurrentState(this.instanceName)
        return currentState.configuration.output !== undefined
    }

    async isProvisioned(): Promise<boolean> {
        const currentState = await this.stateWriter.getCurrentState(this.instanceName)
        return currentState.provision.output !== undefined
    }

    async isReady(): Promise<boolean> {
        const isConfiguredAndProvisioned = await this.isConfigured() && await this.isProvisioned()
        if(!isConfiguredAndProvisioned){
            this.logger.debug(`Instance ${this.name()} is not configured or provisioned. Not ready.`)
            return false
        }

        // building runner fails if instance is not provisioned
        const runner = await this.buildRunner()
        const streamingServerReady = await runner.isStreamingServerReady()
        return streamingServerReady
    }
}