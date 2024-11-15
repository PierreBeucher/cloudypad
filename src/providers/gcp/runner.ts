import { AbstractInstanceRunner, InstanceRunnerArgs } from '../../core/runner';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionConfigV1, GcpProvisionOutputV1 } from './state';

export type GcpInstanceRunnerArgs = InstanceRunnerArgs<GcpProvisionConfigV1, GcpProvisionOutputV1>

export class GcpInstanceRunner extends AbstractInstanceRunner<GcpProvisionConfigV1, GcpProvisionOutputV1>  {

    private client: GcpClient

    constructor(args: GcpInstanceRunnerArgs) {
        super(args)

        this.client = new GcpClient(args.instanceName, args.config.projectId)
    }

    private getinstanceName(): string{
        return this.args.instanceName, this.args.output.instanceName
    }

    private getZone(): string{
        return this.args.instanceName, this.args.config.zone
    }

    async start() {
        await super.start()
        this.client.startInstance(this.getZone(), this.getinstanceName())
    }

    async stop() {
        await super.stop()
        this.client.stopInstance(this.getZone(), this.getinstanceName())
    }

    async restart() {
        await super.restart()
        this.client.restartInstance(this.getZone(), this.getinstanceName())
    }
}
