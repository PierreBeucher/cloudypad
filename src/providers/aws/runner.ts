import { AbstractInstanceRunner, AbstractInstanceRunnerArgs } from '../../core/runner';
import { AwsClient } from '../../tools/aws';
import { AwsProviderConfigV1, AwsProviderStateV1 } from './state';

export interface AwsInstanceRunnerArgs extends AbstractInstanceRunnerArgs {
    awsConfig: AwsProviderConfigV1,
    awsState: AwsProviderStateV1,
}

export class AwsInstanceRunner extends AbstractInstanceRunner {

    private awsClient: AwsClient
    private readonly awsArgs: AwsInstanceRunnerArgs

    constructor(args: AwsInstanceRunnerArgs) {
        super(args)
        this.awsArgs = args

        this.awsClient = new AwsClient(args.instanceName, args.awsConfig.region)
    }

    private getInstanceId(){
        return this.awsArgs.awsState.instanceId
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