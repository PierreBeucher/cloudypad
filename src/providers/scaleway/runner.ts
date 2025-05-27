import { CLOUDYPAD_PROVIDER_SCALEWAY } from '../../core/const'
import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner'
import { ScalewayClient, ScalewayServerState } from '../../tools/scaleway'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'

export type ScalewayInstanceRunnerArgs = InstanceRunnerArgs<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>

export class ScalewayInstanceRunner extends AbstractInstanceRunner<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>  {

    private client: ScalewayClient

    constructor(args: ScalewayInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_SCALEWAY, args)

        this.client = new ScalewayClient(args.provisionOutput.instanceName, {
            projectId: args.provisionInput.projectId,
            zone: args.provisionInput.zone,
            region: args.provisionInput.region,
        })
    }

    /**
     * Returns the instance server ID if it is available. Throws an error if it is not available.
     * As instance server ID may be unset if the instance is not fully provisioned, this method will throw an error if the instance server ID is not set.
     */
    private getInstanceServerIdSafe() {
        if(!this.args.provisionOutput.instanceServerId) {
            throw new Error(`Instance server ID not found for instance ${this.args.provisionOutput.instanceName}. Is instance fully provisioned?`)
        }
        return this.args.provisionOutput.instanceServerId
    }

    async doStart(opts?: StartStopOptions) {
        const currentStatus = await this.doGetInstanceStatus()
        if(currentStatus === ServerRunningStatus.Running) {
            this.logger.info(`Instance ${this.args.provisionOutput.instanceName} is already running.`)
            return
        }

        const instanceServerId = this.getInstanceServerIdSafe()

        await this.client.startInstance(instanceServerId, {
            wait: opts?.wait,
        })
    }

    async doStop(opts?: StartStopOptions) {
        const currentStatus = await this.doGetInstanceStatus()
        if(currentStatus === ServerRunningStatus.Stopped) {
            this.logger.info(`Instance ${this.args.provisionOutput.instanceName} is already stopped.`)
            return
        }

        const instanceServerId = this.getInstanceServerIdSafe()

        await this.client.stopInstance(instanceServerId, opts)
    }

    async doRestart(opts?: StartStopOptions) {
        const instanceServerId = this.getInstanceServerIdSafe()
        await this.client.restartInstance(instanceServerId, opts)
    }

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        const instanceServerId = this.getInstanceServerIdSafe()
        const status = await this.client.getInstanceStatus(instanceServerId)

        switch(status) {
            case ScalewayServerState.Running:
                return ServerRunningStatus.Running
            case ScalewayServerState.Stopped:
                return ServerRunningStatus.Stopped
            case ScalewayServerState.Starting:
                return ServerRunningStatus.Starting
            case ScalewayServerState.Stopping:
                return ServerRunningStatus.Stopping
            case ScalewayServerState.Unknown:
                return ServerRunningStatus.Unknown
            default:
                return ServerRunningStatus.Unknown
        }
    }
}
