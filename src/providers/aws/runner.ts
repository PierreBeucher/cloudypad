import { AbstractInstanceRunner, InstanceRunnerArgs, StartStopOptions } from '../../core/runner';
import { AwsClient } from '../../tools/aws';
import { AwsProvisionInputV1, AwsProvisionOutputV1 } from './state';

export type AwsInstanceRunnerArgs = InstanceRunnerArgs<AwsProvisionInputV1, AwsProvisionOutputV1>

export class AwsInstanceRunner extends AbstractInstanceRunner<AwsProvisionInputV1, AwsProvisionOutputV1>  {

    private awsClient: AwsClient

    constructor(args: AwsInstanceRunnerArgs) {
        super(args)

        this.awsClient = new AwsClient(args.instanceName, args.input.region)
    }

    private getInstanceId(){
        return this.args.output.instanceId
    }

    async doStart(opts?: StartStopOptions) {
        const instanceId = this.getInstanceId()
        await this.awsClient.startInstance(instanceId, opts)
    }

    async doStop(opts?: StartStopOptions) {
        const instanceId = this.getInstanceId()
        await this.awsClient.stopInstance(instanceId, opts)
    }

    async doRestart(opts?: StartStopOptions) {
        const instanceId = this.getInstanceId()
        await this.awsClient.restartInstance(instanceId, opts)
    }
}