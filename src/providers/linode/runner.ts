import { CLOUDYPAD_PROVIDER_LINODE } from '../../core/const'
import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner'
import { LinodeClient, LinodeInstanceStatus } from './sdk-client'
import { LinodeProvisionInputV1, LinodeProvisionOutputV1 } from './state'

export type LinodeInstanceRunnerArgs = InstanceRunnerArgs<LinodeProvisionInputV1, LinodeProvisionOutputV1>

export class LinodeInstanceRunner extends AbstractInstanceRunner<LinodeProvisionInputV1, LinodeProvisionOutputV1>  {

    private client: LinodeClient

    constructor(args: LinodeInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_LINODE, args)

        this.client = new LinodeClient({
            region: args.provisionInput.region,
        })
    }

    /**
     * Returns the instance server ID if it is available. Throws an error if it is not available.
     * As instance server ID may be unset if the instance is not fully provisioned, this method will throw an error if the instance server ID is not set.
     */
    private getInstanceServerIdSafe(): number {
        const serverId = this.getInstanceServerId()
        if(!serverId) {
            throw new Error(`Instance server ID not found for instance ${this.args.provisionOutput.instanceServerName}. Is instance fully provisioned?`)
        }
        return parseInt(serverId)
    }

    private getInstanceServerId(): string | undefined {
        return this.args.provisionOutput.instanceServerId
    }

    async doStart(opts?: StartStopOptions) {
        const currentStatus = await this.doGetInstanceStatus()
        if(currentStatus === ServerRunningStatus.Running) {
            this.logger.info(`Instance ${this.args.provisionOutput.instanceServerName} is already running.`)
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
            this.logger.info(`Instance ${this.args.provisionOutput.instanceServerName} is already stopped.`)
            return
        }

        const instanceServerId = this.getInstanceServerIdSafe()

        await this.client.stopInstance(instanceServerId, {
            wait: opts?.wait,
        })
    }

    async doRestart(opts?: StartStopOptions) {
        const instanceServerId = this.getInstanceServerIdSafe()
        await this.client.restartInstance(instanceServerId, {
            wait: opts?.wait,
        })
    }

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        const instanceServerId = this.getInstanceServerId()
        if(!instanceServerId) {
            return ServerRunningStatus.Unknown
        }

        const status = await this.client.getInstanceStatus(instanceServerId)

        switch(status) {
            case 'booting':
            case 'provisioning':
                return ServerRunningStatus.Starting
            case 'running':
                return ServerRunningStatus.Running
            case 'shutting_down':
            case 'deleting':
                return ServerRunningStatus.Stopping
            case 'stopped':
            case 'offline':
                return ServerRunningStatus.Stopped
            case 'rebooting':
                return ServerRunningStatus.Restarting
            default:
                return ServerRunningStatus.Unknown
        }
    }
} 