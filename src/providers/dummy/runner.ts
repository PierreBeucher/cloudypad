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
        this.logger.info(`Dummy start operation for instance: ${this.args.instanceName}`)
        
        if(opts?.wait) {
            this.setInstanceStatus(InstanceRunningStatus.Starting)
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        this.setInstanceStatus(InstanceRunningStatus.Running)
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy stop operation for instance: ${this.args.instanceName}`)

        if(opts?.wait) {
            this.setInstanceStatus(InstanceRunningStatus.Stopping)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.setInstanceStatus(InstanceRunningStatus.Stopped)
    }

    async restart(opts?: StartStopOptions): Promise<void> {
        this.logger.info(`Dummy restart operation for instance: ${this.args.instanceName}`)
        await this.stop(opts)
        await this.start(opts)
    }

    async instanceStatus(): Promise<InstanceRunningStatus> {
        const details = DummyInstanceInternalMemory.get().getInstanceDetails(this.args.instanceName)
        this.logger.info(`Dummy get status operation for instance: ${this.args.instanceName} returning ${JSON.stringify(details)}`)
        return details?.status ?? InstanceRunningStatus.Unknown
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