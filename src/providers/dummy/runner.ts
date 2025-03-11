import { InstanceRunner, InstanceRunnerArgs, InstanceRunningStatus, StartStopOptions } from '../../core/runner';
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
            this.setInstanceStatus(InstanceRunningStatus.Starting)
            const startingPromise = new Promise<void>(resolve => setTimeout(() => {
                this.setInstanceStatus(InstanceRunningStatus.Running)
                resolve()
            }, this.args.provisionInput.startingTimeSeconds * 1000))
            
            if(opts?.wait) {
                await startingPromise
            }
        } else {
            this.setInstanceStatus(InstanceRunningStatus.Running)
        }
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy stop operation for instance: ${this.args.instanceName} (stopping time: ${this.args.provisionInput.stoppingTimeSeconds} seconds)`)

        if(this.args.provisionInput.stoppingTimeSeconds > 0) {
            this.setInstanceStatus(InstanceRunningStatus.Stopping)
            const stoppingPromise = new Promise<void>(resolve => setTimeout(() => {
                this.setInstanceStatus(InstanceRunningStatus.Stopped)
                resolve()
            }, this.args.provisionInput.stoppingTimeSeconds * 1000))
            
            if(opts?.wait) {
                await stoppingPromise
            }
        } else {
            this.setInstanceStatus(InstanceRunningStatus.Stopped)
        }
    }

    async restart(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy restart operation for instance: ${this.args.instanceName}`)
        await this.stop(opts)
        await this.start(opts)
    }

    async instanceStatus(): Promise<InstanceRunningStatus> {
        const details = DummyInstanceInternalMemory.get().getInstanceDetails(this.args.instanceName)
        this.logger.info(`Dummy get status operation for instance: ${this.args.instanceName} returning ${JSON.stringify(details)}`)
        return details?.status ?? InstanceRunningStatus.Stopped
    }

    async pairInteractive(): Promise<void> {
        this.logger.info(`Dummy pair interactive operation for instance: ${this.args.instanceName}`)
    }

    async pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean> {
        this.logger.info(`Dummy pair send pin operation for instance: ${this.args.instanceName} with pin: ${pin}`)
        return true
    }

    private setInstanceStatus(status: InstanceRunningStatus) {
        DummyInstanceInternalMemory.get().setInstanceDetails(this.args.instanceName, {
            instanceName: this.args.instanceName,
            status: status
        })
    }
}