import { AbstractInstanceRunner, InstanceRunnerArgs } from '../../core/runner';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionInputV1, GcpProvisionOutputV1 } from './state';

export type GcpInstanceRunnerArgs = InstanceRunnerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpInstanceRunner extends AbstractInstanceRunner<GcpProvisionInputV1, GcpProvisionOutputV1>  {

    private client: GcpClient

    constructor(args: GcpInstanceRunnerArgs) {
        super(args)

        this.client = new GcpClient(args.instanceName, args.input.projectId)
    }

    private getinstanceName(): string{
        return this.args.instanceName, this.args.output.instanceName
    }

    private getZone(): string{
        return this.args.instanceName, this.args.input.zone
    }

    async doStart() {
        this.client.startInstance(this.getZone(), this.getinstanceName())
    }

    async doStop() {
        this.client.stopInstance(this.getZone(), this.getinstanceName())
    }

    async doRestart() {
        this.client.restartInstance(this.getZone(), this.getinstanceName())
    }
}
