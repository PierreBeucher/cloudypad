import { CLOUDYPAD_PROVIDER_GCP } from '../../core/const';
import { AbstractInstanceRunner, InstanceRunnerArgs, StartStopOptions } from '../../core/runner';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionInputV1, GcpProvisionOutputV1 } from './state';

export type GcpInstanceRunnerArgs = InstanceRunnerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpInstanceRunner extends AbstractInstanceRunner<GcpProvisionInputV1, GcpProvisionOutputV1>  {

    private client: GcpClient

    constructor(args: GcpInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_GCP, args)

        this.client = new GcpClient(args.instanceName, args.provisionInput.projectId)
    }

    private getinstanceName(): string{
        return this.args.instanceName
    }

    private getZone(): string{
        return this.args.provisionInput.zone
    }

    async doStart(opts?: StartStopOptions) {
        await this.client.startInstance(this.getZone(), this.getinstanceName(), opts)
    }

    async doStop(opts?: StartStopOptions) {
        await this.client.stopInstance(this.getZone(), this.getinstanceName(), opts)
    }

    async doRestart(opts?: StartStopOptions) {
        await this.client.restartInstance(this.getZone(), this.getinstanceName(), opts)
    }
}
