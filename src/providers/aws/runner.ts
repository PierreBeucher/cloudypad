import { AbstractInstanceRunner } from '../../core/runner';
import { StateManager } from '../../core/state';
import { AwsClient } from '../../tools/aws';

export class AwsInstanceRunner extends AbstractInstanceRunner {

    private awsClient: AwsClient

    constructor(sm: StateManager) {
        super(sm)

        const state = sm.get()
        if(!state.provider?.aws) {
            throw new Error(`Invalidate state: provider must be AWS, got state ${sm.get()}`)
        }

        if(!state.provider?.aws?.provisionArgs || !sm.get().provider?.aws?.provisionArgs?.create) {
            throw new Error(`Invalidate state: missing AWS provison args, got state ${sm.get()}`)
        }

        this.awsClient = new AwsClient(sm.name(), state.provider.aws?.provisionArgs?.create.region)
    }

    private getInstanceId(){
        const state = this.stateManager.get()
        if(!state.provider?.aws?.instanceId){
            throw new Error("Couldn't perform operation: unknown instance ID.")
        }

        return state.provider?.aws?.instanceId
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