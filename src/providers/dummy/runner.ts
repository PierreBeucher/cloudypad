import { InstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { getLogger, Logger } from '../../log/utils';
import { DummyInstanceInternalMemory } from './internal-memory';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';

export type DummyInstanceRunnerArgs = InstanceRunnerArgs<DummyProvisionInputV1, DummyProvisionOutputV1>

/**
 * A Dummy instance runner that simulates the behavior of an instance.
 * 
 * Voluntarily does not extend AbstractInstanceRunner for simplicity
 * and to avoid having stubs removing desired behavior during tests
 */
export class DummyInstanceRunner implements InstanceRunner {

    private readonly logger: Logger
    private readonly args: DummyInstanceRunnerArgs

    constructor(args: DummyInstanceRunnerArgs) {
        this.logger = getLogger(args.instanceName)
        this.args = args
    }


    async start(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy start operation for instance: ${this.args.instanceName} (starting time: ${this.args.provisionInput.startingTimeSeconds} seconds)`)
        
        if(this.args.provisionInput.startingTimeSeconds > 0) {
            this.setInstanceStatus(ServerRunningStatus.Starting)
            const startingPromise = new Promise<void>(resolve => setTimeout(() => {
                this.setInstanceStatus(ServerRunningStatus.Running)
                resolve()
            }, this.args.provisionInput.startingTimeSeconds * 1000))
            
            if(opts?.wait) {
                await startingPromise
            }
        } else {
            this.setInstanceStatus(ServerRunningStatus.Running)
        }
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy stop operation for instance: ${this.args.instanceName} (stopping time: ${this.args.provisionInput.stoppingTimeSeconds} seconds)`)

        if(this.args.provisionInput.stoppingTimeSeconds > 0) {
            this.setInstanceStatus(ServerRunningStatus.Stopping)
            const stoppingPromise = new Promise<void>(resolve => setTimeout(() => {
                this.setInstanceStatus(ServerRunningStatus.Stopped)
                resolve()
            }, this.args.provisionInput.stoppingTimeSeconds * 1000))
            
            if(opts?.wait) {
                await stoppingPromise
            }
        } else {
            this.setInstanceStatus(ServerRunningStatus.Stopped)
        }
    }

    async restart(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy restart operation for instance: ${this.args.instanceName}`)
        await this.stop(opts)
        await this.start(opts)
    }

    async serverStatus(): Promise<ServerRunningStatus> {
        const details = DummyInstanceInternalMemory.get().getInstanceDetails(this.args.instanceName)
        this.logger.info(`Dummy get status operation for instance: ${this.args.instanceName} returning ${JSON.stringify(details)}`)
        return details?.status ?? ServerRunningStatus.Stopped
    }

    async pairInteractive(): Promise<void> {
        this.logger.info(`Dummy pair interactive operation for instance: ${this.args.instanceName}`)
    }

    async pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean> {
        this.logger.info(`Dummy pair send pin operation for instance: ${this.args.instanceName} with pin: ${pin}`)
        return true
    }

    private setInstanceStatus(status: ServerRunningStatus) {
        DummyInstanceInternalMemory.get().setInstanceDetails(this.args.instanceName, {
            instanceName: this.args.instanceName,
            status: status
        })
    }

    /**
     * Dummy implementation of streaming server readiness. Returns true is current status is running.
     */
    async isStreamingServerReady(): Promise<boolean> {
        const status = await this.serverStatus()
        return status === ServerRunningStatus.Running
    }
}   