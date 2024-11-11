import { AbstractInstanceRunner, InstanceRunnerArgs } from '../../core/runner';
import { AwsClient } from '../../tools/aws';
import { AwsProvisionConfigV1, AwsProvisionOutputV1 } from './state';

export type AwsInstanceRunnerArgs = InstanceRunnerArgs<AwsProvisionConfigV1, AwsProvisionOutputV1>

export class AwsInstanceRunner extends AbstractInstanceRunner<AwsProvisionConfigV1, AwsProvisionOutputV1>  {

    private awsClient: AwsClient

    constructor(args: AwsInstanceRunnerArgs) {
        super(args)

        this.awsClient = new AwsClient(args.instanceName, args.config.region)
    }

    private getInstanceId(){
        return this.args.output.instanceId
    }

    async start() {
        await super.start()
        const instanceId = this.getInstanceId()
        await this.awsClient.startInstance(instanceId)
    }

    async stop() {
        await super.stop()
        const instanceId = this.getInstanceId()
        await this.awsClient.stopInstance(instanceId)
    }

    async restart() {
        await super.restart()
        const instanceId = this.getInstanceId()
        await this.awsClient.restartInstance(instanceId)
    }
}