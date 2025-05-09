import { CLOUDYPAD_PROVIDER_GCP } from '../../core/const';
import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { GcpClient, GcpInstanceStatus } from '../../tools/gcp';
import { GcpProvisionInputV1, GcpProvisionOutputV1 } from './state';

export type GcpInstanceRunnerArgs = InstanceRunnerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpInstanceRunner extends AbstractInstanceRunner<GcpProvisionInputV1, GcpProvisionOutputV1>  {

    private client: GcpClient

    constructor(args: GcpInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_GCP, args)

        this.client = new GcpClient(args.instanceName, args.provisionInput.projectId)
    }

    private getinstanceName(): string{
        return `cloudypad-${this.args.instanceName}`
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

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        const status = await this.client.getInstanceState(this.getZone(), this.getinstanceName())
        
        switch(status) {
            case GcpInstanceStatus.Provisioning:
            case GcpInstanceStatus.Staging:
                return ServerRunningStatus.Starting;
            case GcpInstanceStatus.Running:
                return ServerRunningStatus.Running;
            case GcpInstanceStatus.Stopping:
            case GcpInstanceStatus.Suspending:
                return ServerRunningStatus.Stopping;
            case GcpInstanceStatus.Suspended:
            case GcpInstanceStatus.Repairing:
            case GcpInstanceStatus.Terminated:
                return ServerRunningStatus.Stopped;
            case GcpInstanceStatus.Unknown:
            default:
                return ServerRunningStatus.Unknown;
        }
    }
}