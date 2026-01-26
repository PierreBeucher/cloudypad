import { CommonInstanceInput, CommonProvisionInputV1, InstanceEvent, InstanceEventEnum, InstanceStateV1 } from './state/state';
import { DATA_DISK_STATE, DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT, INSTANCE_SERVER_STATE, INSTANCE_SERVER_STATE_ABSENT, INSTANCE_SERVER_STATE_PRESENT } from './const';
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
 * Main operation interface to manage an instance: deploy, provision configure, start/stop/restart, destroy...
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
 * 
 * Each action function (stop, start, configure, provision, etc.) is a wrapper with retry around
 * low-level action functions (doStart, doStop, doConfigure, doProvision, etc.).
 * - a top-level action like deploy() may rely on other top-level actions like configure()
 *   or call underlying low-level actions like doConfigure wrapped in a retry().
 *   They may also container logic like retry pattern, starting instance before configuring, etc.
 * - a low-level action like doConfigure() must NOT call another low-level NOR top-level action.
 *   These functions should only strictly do the required action without any mre logic.
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

        // before configuring, check instance is running as it's possible user would call configure() directly without starting the instance first
        // start it if needed
        const currentStatus = await this.getInstanceStatus()
        if(currentStatus.serverStatus !== ServerRunningStatus.Running){

            this.logger.debug(`About to run configuration for instance ${this.name()} but it's not running, starting it first...`)

            await this.doWithRetry(async () => {
                await this.doStart({ wait: true })
            }, 'Pre-configure start', opts)
        }

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
        // We'll perform a full provision and configuration to ensure instance is fully provisioned and configured
        // we need instance server and data disk to be present
        await this.updateProvisionInputRuntime({
            instanceServerState: INSTANCE_SERVER_STATE_PRESENT,
            dataDiskState: DATA_DISK_STATE_LIVE
        })
        
        await this.provision(opts)
        await this.configure(opts)

        // After provision and configure, create base image snapshot if enabled
        const currentState = await this.getState()
        if (currentState.provision.input.baseImageSnapshot?.enable) {
            await this.doBaseImageSnapshotProvision(opts)
        }
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

        const currentState = await this.getState()

        await this.doWithRetry(async () => {

            // if deleteInstanceServerOnStop or dataDiskSnapshot is enabled, we need to provision the instance
            // as instance server may not exist and/or data disk snapshot may need to be restored
            if(currentState.provision.input.deleteInstanceServerOnStop ||
                currentState.provision.input.dataDiskSnapshot?.enable
            ){
                // Update inputs to restore live data disk from snapshot (if any)
                // and ensure instance server exists
                await this.updateProvisionInputRuntime({
                    instanceServerState: INSTANCE_SERVER_STATE_PRESENT,
                    dataDiskState: DATA_DISK_STATE_LIVE
                })

                await this.doProvision(opts)
            
                // always reconfigured instance using limited Ansible run to avoid re-running full configuration on every start
                await this.doConfigure(['-t', 'ratelimit,data-disk,sunshine'])
            }
        }, 'Pre-start reconfiguration', opts)

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
     * Update provision input runtime state in state.
     * These control what the provisioner does (create/destroy server, disk state).
     */
    private async updateProvisionInputRuntime(runtime: {
        instanceServerState?: INSTANCE_SERVER_STATE,
        dataDiskState?: DATA_DISK_STATE
    }): Promise<void> {
        const currentState = await this.stateWriter.getCurrentState(this.instanceName)
        const updatedInput: CommonProvisionInputV1 = {
            ...currentState.provision.input,
            runtime: {
                instanceServerState: runtime.instanceServerState,
                dataDiskState: runtime.dataDiskState
            }
        }
        await this.stateWriter.setProvisionInput(this.instanceName, updatedInput)
        this.logger.debug(`Updated provision input runtime: ${JSON.stringify(runtime)}`)
    }

    /**
     * Configure instance using Ansible configurator and update state with configuration output.
     * Decorellated from main configure() method as it may be run for configuration and as post-start reconfiguration by start().
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
     * 
     * Runs provisioning in two steps:
     * 1. data snapshot provision: update or create data snapshot based on provided inputs
     *    eg. on stop will create a snapshot from data disk, on start won't do anything.
     * 2. main provision: manages main infrastructure based on runtime flags
     *    eg. will restore live data disk from snapshot if any, create a new data disk if none exists.
     * 
     * State is updated after each step to ensure outputs are persisted.
     */
    async doProvision(opts?: ActionOptions): Promise<void> {

        this.logger.debug(`Do provision instance ${this.name()}`)

        const currentState = await this.getState()
        const provisioner = await this.buildProvisioner()

        // Data snapshot provision. Only call if dataDiskSnapshot is enabled
        if(currentState.provision.input.dataDiskSnapshot?.enable){
            this.logger.debug(`Running data snapshot provision for instance ${this.name()}`)
            const snapshotOutputs = await provisioner.dataSnapshotProvision({
                pulumiCancel: opts?.pulumiCancel
            })
            this.logger.debug(`Data snapshot provision output for instance ${this.name()}: ${JSON.stringify(snapshotOutputs)}`)
            await this.stateWriter.setProvisionOutput(this.instanceName, snapshotOutputs)
        }

        // Main provision (manages server, disks, network...)
        // Rebuild provisioner to get updated state with snapshot outputs
        const provisionerForMain = await this.buildProvisioner()
        this.logger.debug(`Running main provision for instance ${this.name()}`)
        const mainOutputs = await provisionerForMain.mainProvision({
            pulumiCancel: opts?.pulumiCancel
        })
        this.logger.debug(`Main provision output for instance ${this.name()}: ${JSON.stringify(mainOutputs)}`)
        await this.stateWriter.setProvisionOutput(this.instanceName, mainOutputs)
    }

    /**
     * Create a base image snapshot from current instance server root disk.
     * Will stop instance to ensure data consistency before creating snapshot.
     */
    private async doBaseImageSnapshotProvision(opts?: ActionOptions): Promise<void> {
        this.logger.debug(`Do base image snapshot provision for instance ${this.name()}`)

        // Stop instance to ensure data consistency before creating snapshot
        // Directly via runner, not via this.stop(), to ensure disk is kept before creating snapshot
        // We don't want a full "stop" of all resources which may delete the instance server and root disk
        // but a simple instance server stop from which we'll create a base image
        await this.doWithRetry(async () => {
            const runner = await this.buildRunner()
            await runner.stop({ wait: true })
        }, 'Pre-snapshot stop', opts)
        
        // Create base image snapshot
        await this.doWithRetry(async () => {
            const provisioner = await this.buildProvisioner()
            const outputs = await provisioner.baseImageSnapshotProvision({
                pulumiCancel: opts?.pulumiCancel
            })
            this.logger.debug(`Base image snapshot provision output for instance ${this.name()}: ${JSON.stringify(outputs)}`)
            await this.stateWriter.setProvisionOutput(this.instanceName, outputs)
        }, 'Base image snapshot', opts)
        
        // Start instance back up via runner
        await this.doWithRetry(async () => {
            const runner = await this.buildRunner()
            await runner.start({ wait: true })
        }, 'Post-snapshot start', opts)
    }

    /**
     * Start instance using runner.
     */
    async doStart(opts?: StartOptions): Promise<void> {

        // always start instance as provisioning and configuring may not start the server for all providers
        // and startOptions logic is ported by runner
        const runner = await this.buildRunner()
        await runner.start(opts)
    }

    /**
     * Stop instance using runner and optionally delete resources via provisioner.
     * 
     * Stop flow:
     * 1. Stop instance server via runner
     * 2. If deleteInstanceServerOnStop or dataDiskSnapshot is enabled:
     *    - Update state input runtime (noInstanceServer, noDataDisk, createDataDiskSnapshot)
     *    - Call provisioner to handle resource deletion and snapshot creation
     * 
     * In itself stop is not only managed via a stop operation on instance server, but also via infra as code
     * with input setting desired state of resources for a "stop" status.
     */
    async doStop(opts?: StopOptions): Promise<void> {
        const currentState = await this.getState()
        const runner = await this.buildRunner()

        // First stop the instance via runner (unless server already stopped)
        const serverStatus = await runner.serverStatus()
        let serverStopSuccess = false
        if(serverStatus === ServerRunningStatus.Stopped){
            serverStopSuccess = true
            this.logger.info(`Instance ${this.name()} is already stopped, skipping stop operation.`)
        } else if(serverStatus !== ServerRunningStatus.Unknown){
            // if data disk snapshot is enabled, force stop wait to ensure data consistency
            // creating a data disk snapshot on a still running instance may corrupt data
            const forceStopWait = currentState.provision.input.dataDiskSnapshot?.enable ?? false

            try {
                await runner.stop({ 
                    ...opts, 
                    wait: forceStopWait || opts?.wait
                })
                serverStopSuccess = true
            } catch (error) {
                this.logger.warn(`Failed to stop instance ${this.name()}`, error)
            }
        } else {
            // this runs when server status is unknown
            // instance server may have been deleted (by previous stop run)
            // it's also possible we somehow lost track of the server (eg. provider API issue)
            // handled below since we did not confirm server deletion with serverStopSuccess=true
            // and we risk a dangling server
            this.logger.info(`Instance ${this.name()} does not have a server (or server in unknown state). Skipping stop operation.`)
        }

        // If provisioning is required (delete instance server or create snapshot), update runtime input state and call provision
        // we need to update input to pass proper snapshot ID and desired instance server state to provisioner
        if(currentState.provision.input.deleteInstanceServerOnStop || 
            currentState.provision.input.dataDiskSnapshot?.enable
        ){
            await this.updateProvisionInputRuntime({
                // on stop, if deleteInstanceServerOnStop is enabled, we need to explicitely delete the server
                // otherwise leave undefined to keep default behavior
                instanceServerState: currentState.provision.input.deleteInstanceServerOnStop ? INSTANCE_SERVER_STATE_ABSENT : undefined,

                // on stop, if dataDiskSnapshot is enabled, we need to create a snapshot, otherwise keep live disk
                dataDiskState: currentState.provision.input.dataDiskSnapshot?.enable ? DATA_DISK_STATE_SNAPSHOT : DATA_DISK_STATE_LIVE
            })

            // run provision will remove server (if needed) and remove data disk (if needed) based on updated inputs
            await this.doProvision(opts)

            // Reset configuration output since server was deleted, it's not configured anymore
            if(currentState.provision.input.deleteInstanceServerOnStop){
                await this.stateWriter.setConfigurationOutput(this.instanceName, undefined)
            }
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