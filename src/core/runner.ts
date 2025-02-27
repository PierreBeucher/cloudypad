import { CommonConfigurationInputV1, CommonProvisionInputV1, CommonProvisionOutputV1 } from './state/state';
import { getLogger, Logger } from '../log/utils';
import { AnalyticsClient } from '../tools/analytics/client';
import { AnalyticsManager } from '../tools/analytics/manager';
import { RUN_COMMAND_START } from '../tools/analytics/events';
import { CLOUDYPAD_PROVIDER } from './const';
import { SunshineMoonlightPairer } from './moonlight/pairer/sunshine';
import { MoonlightPairer } from './moonlight/pairer/abstract';
import { WolfMoonlightPairer } from './moonlight/pairer/wolf';

/**
 * Options that may be passed to InstanceRunner functions
 */
export interface InstanceRunnerOptions  {

}

export enum InstanceRunningStatus {
    Running = 'running',
    Stopped = 'stopped',
    Restarting = 'restarting',
    Starting = 'starting',
    Stopping = 'stopping',
    Unknown = 'unknown'
}

/**
 * Instance Runner manages running time lifecycle of instances: start/stop/restart
 * and utility functions like pairing and fetching Moonlight PIN
 */
export interface InstanceRunner {

    start(opts?: StartStopOptions): Promise<void>
    stop(opts?: StartStopOptions): Promise<void>
    restart(opts?: StartStopOptions): Promise<void>

    /**
     * Returns the current running status of the instance
     */
    instanceStatus(): Promise<InstanceRunningStatus>

    /**
     * Interactively pair with Moonlight. This is only suitable for interactive (eg. CLI) use
     */
    pairInteractive(): Promise<void>

    /**
     * Send pairing PIN to the instance
     * @returns true if the PIN was valid and pairing was successful, false otherwise
     */
    pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean>
}

export interface InstanceRunnerArgs<C extends CommonProvisionInputV1, O extends CommonProvisionOutputV1>  {
    instanceName: string, 
    provisionInput: C
    provisionOutput: O
    configurationInput: CommonConfigurationInputV1
}

export interface StartStopOptions {
    wait?: boolean
    waitTimeoutSeconds?: number
}

export abstract class AbstractInstanceRunner<C extends CommonProvisionInputV1, O extends CommonProvisionOutputV1> implements InstanceRunner {
    
    protected readonly logger: Logger
    protected readonly args: InstanceRunnerArgs<C, O>
    private analytics: AnalyticsClient
    private provider: CLOUDYPAD_PROVIDER

    constructor(provider: CLOUDYPAD_PROVIDER, args: InstanceRunnerArgs<C, O>) {
        this.args = args
        this.provider = provider
        this.logger = getLogger(args.instanceName) 
        this.analytics = AnalyticsManager.get()
    }
 
    async start(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Starting instance ${this.args.instanceName}`)
        this.analytics.sendEvent(RUN_COMMAND_START, { 
            provider: this.provider,
        })
        await this.doStart(opts)
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Stopping instance ${this.args.instanceName}`)
        await this.doStop(opts)
    }

    async restart(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Restarting instance ${this.args.instanceName}`)
        await this.doRestart(opts)
    }

    async instanceStatus(): Promise<InstanceRunningStatus> {
        this.logger.info(`Getting instance state for ${this.args.instanceName}`) 
        return this.doGetInstanceStatus()
    }

    protected abstract doStart(opts?: StartStopOptions): Promise<void>
    protected abstract doStop(opts?: StartStopOptions): Promise<void>
    protected abstract doRestart(opts?: StartStopOptions): Promise<void>
    protected abstract doGetInstanceStatus(): Promise<InstanceRunningStatus>

    private buildMoonlightPairer(): MoonlightPairer {
        if(this.args.configurationInput.sunshine?.enable){
            return new SunshineMoonlightPairer({
                instanceName: this.args.instanceName,
                host: this.args.provisionOutput.host,
                ssh: {
                    user: this.args.provisionInput.ssh.user,
                    privateKeyPath: this.args.provisionInput.ssh.privateKeyPath
                },
                sunshine: {
                    username: this.args.configurationInput.sunshine.username,
                    password: Buffer.from(this.args.configurationInput.sunshine.passwordBase64, 'base64').toString('utf-8')
                }
            })
        } else if(this.args.configurationInput.wolf?.enable){
            return new WolfMoonlightPairer({
                instanceName: this.args.instanceName,
                host: this.args.provisionOutput.host,
                ssh: {
                    user: this.args.provisionInput.ssh.user,
                    privateKeyPath: this.args.provisionInput.ssh.privateKeyPath
                }
            })
        } else {
            throw new Error(`No Moonlight pairer found for instance ${this.args.instanceName}, neither Sunshine nor Wolf is enabled`)
        }
    }

    async pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean> {
        const pairer = this.buildMoonlightPairer()
        return pairer.pairSendPin(pin, retries, retryDelay)
    }
    
    async pairInteractive(){
        const pairer = this.buildMoonlightPairer()
        await pairer.pairInteractive()
    }

   
}

