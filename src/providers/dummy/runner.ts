import { CLOUDYPAD_PROVIDER_DUMMY } from '../../core/const';
import { AbstractInstanceRunner, InstanceRunnerArgs, InstanceRunningStatus, StartStopOptions } from '../../core/runner';
import { DummyInstanceProviderClient } from './internal-memory';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';

export type DummyInstanceRunnerArgs = InstanceRunnerArgs<DummyProvisionInputV1, DummyProvisionOutputV1>

/**
 * A Dummy instance runner that simulates the behavior of an instance.
 */
export class DummyInstanceRunner extends AbstractInstanceRunner<DummyProvisionInputV1, DummyProvisionOutputV1>  {

    constructor(args: DummyInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_DUMMY, args)
    }

    private setInstanceStatus(status: InstanceRunningStatus) {
        DummyInstanceProviderClient.get().setInstanceDetails(this.args.instanceName, {
            instanceName: this.args.instanceName,
            status: status
        })
    }

    async doStart(opts?: StartStopOptions) {
        this.logger.info(`Dummy start operation for instance: ${this.args.instanceName}`)
        
        if(opts?.wait) {
            this.setInstanceStatus(InstanceRunningStatus.Starting)
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        this.setInstanceStatus(InstanceRunningStatus.Running)
    }

    async doStop(opts?: StartStopOptions) {
        this.logger.info(`Dummy stop operation for instance: ${this.args.instanceName}`)

        if(opts?.wait) {
            this.setInstanceStatus(InstanceRunningStatus.Stopping)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.setInstanceStatus(InstanceRunningStatus.Stopped)
    }

    async doRestart(opts?: StartStopOptions) {
        this.logger.info(`Dummy restart operation for instance: ${this.args.instanceName}`)
        await this.doStop(opts)
        await this.doStart(opts)
    }

    async doGetInstanceStatus(): Promise<InstanceRunningStatus> {
        const details = DummyInstanceProviderClient.get().getInstanceDetails(this.args.instanceName)
        this.logger.info(`Dummy get status operation for instance: ${this.args.instanceName} returning ${JSON.stringify(details)}`)
        return details?.status ?? InstanceRunningStatus.Unknown
    }
}