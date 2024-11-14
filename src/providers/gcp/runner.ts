import { AbstractInstanceRunner, AbstractInstanceRunnerArgs } from '../../core/runner';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionConfigV1, GcpProvisionOutputV1 } from './state';

export interface GcpInstanceRunnerArgs extends AbstractInstanceRunnerArgs {
    gcpConfig: GcpProvisionConfigV1,
    gcpOutput: GcpProvisionOutputV1,
}

export class GcpInstanceRunner extends AbstractInstanceRunner {

    private gcpClient: GcpClient
    private readonly gcpArgs: GcpInstanceRunnerArgs

    constructor(gcpArgs: GcpInstanceRunnerArgs) {
        super(gcpArgs)

        this.gcpArgs = gcpArgs

        this.gcpClient = new GcpClient(this.gcpArgs.instanceName, this.gcpArgs.gcpConfig.projectId)
    }

    private getinstanceName(): string{
        return this.gcpArgs.instanceName, this.gcpArgs.gcpOutput.instanceName
    }

    private getZone(): string{
        return this.gcpArgs.instanceName, this.gcpArgs.gcpConfig.zone
    }

    async start() {
        await super.start()
        this.gcpClient.startInstance(this.getZone(), this.getinstanceName())
    }

    async stop() {
        await super.stop()
        this.gcpClient.stopInstance(this.getZone(), this.getinstanceName())
    }

    async restart() {
        await super.restart()
        this.gcpClient.restartInstance(this.getZone(), this.getinstanceName())
    }
}
