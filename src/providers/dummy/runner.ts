import { CLOUDYPAD_PROVIDER_DUMMY } from '../../core/const';
import { AbstractInstanceRunner, InstanceRunnerArgs, InstanceRunningStatus, StartStopOptions } from '../../core/runner';
import { StateWriter } from '../../core/state/writer';
import { DummyInstanceProviderClient } from './internal-memory';
import { DummyInstanceStateV1, DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';

export type DummyInstanceRunnerArgs = InstanceRunnerArgs<DummyProvisionInputV1, DummyProvisionOutputV1>

/**
 * A Dummy instance runner that simulates the behavior of an instance.
 */
export class DummyInstanceRunner extends AbstractInstanceRunner<DummyProvisionInputV1, DummyProvisionOutputV1>  {

    constructor(args: DummyInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_DUMMY, args)
    }

    private getInstanceId() {
        return this.args.provisionOutput.instanceId
    }

    private setInstanceStatus(status: InstanceRunningStatus) {
        DummyInstanceProviderClient.get().setInstanceDetails(this.getInstanceId(), {
            instanceId: this.getInstanceId(),
            status: status
        })
    }

    async doStart(opts?: StartStopOptions) {
        this.logger.info(`Dummy start operation for instance ID: ${this.getInstanceId()}`)
        
        if(opts?.wait) {
            this.setInstanceStatus(InstanceRunningStatus.Starting)
            await new Promise(resolve => setTimeout(resolve, 5000))
        }

        this.setInstanceStatus(InstanceRunningStatus.Running)
    }

    async doStop(opts?: StartStopOptions) {
        this.logger.info(`Dummy stop operation for instance ID: ${this.getInstanceId()}`)

        if(opts?.wait) {
            this.setInstanceStatus(InstanceRunningStatus.Stopping)
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        this.setInstanceStatus(InstanceRunningStatus.Stopped)
    }

    async doRestart(opts?: StartStopOptions) {
        this.logger.info(`Dummy restart operation for instance ID: ${this.getInstanceId()}`)
        await this.doStop(opts)
        await this.doStart(opts)
    }

    async doGetInstanceStatus(): Promise<InstanceRunningStatus> {
        const status = DummyInstanceProviderClient.get().getInstanceDetails(this.getInstanceId())
        this.logger.info(`Dummy get status operation for instance ID: ${this.getInstanceId()} returning ${status?.status}`)
        return status?.status ?? InstanceRunningStatus.Unknown
    }
}