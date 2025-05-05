import { InstanceStateName } from '@aws-sdk/client-ec2';
import { CLOUDYPAD_PROVIDER_AWS } from '../../core/const';
import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { AwsClient } from '../../tools/aws';
import { AwsProvisionInputV1, AwsProvisionOutputV1 } from './state';

export type AwsInstanceRunnerArgs = InstanceRunnerArgs<AwsProvisionInputV1, AwsProvisionOutputV1>

export class AwsInstanceRunner extends AbstractInstanceRunner<AwsProvisionInputV1, AwsProvisionOutputV1>  {

    private awsClient: AwsClient

    constructor(args: AwsInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_AWS, args)

        this.awsClient = new AwsClient(args.instanceName, args.provisionInput.region)
    }

    private getInstanceId(){
        return this.args.provisionOutput.instanceId
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

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        const instanceId = this.getInstanceId()
        const awsStatus = await this.awsClient.getInstanceState(instanceId)

        if(!awsStatus) {
            return ServerRunningStatus.Unknown
        }

        switch(awsStatus) { 
            case InstanceStateName.running:
                return ServerRunningStatus.Running
            case InstanceStateName.stopped:
                return ServerRunningStatus.Stopped
            case InstanceStateName.stopping:
                return ServerRunningStatus.Stopping
            case InstanceStateName.terminated:
                return ServerRunningStatus.Stopped
            case InstanceStateName.shutting_down:
                return ServerRunningStatus.Stopping
            case InstanceStateName.pending:
                return ServerRunningStatus.Starting
            default:
                return ServerRunningStatus.Unknown
        }
    }
}