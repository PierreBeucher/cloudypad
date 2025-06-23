import { InstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { getLogger, Logger } from '../../log/utils';
import { DummyInstanceInfraManager } from './infra';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';

export interface DummyInstanceRunnerArgs extends InstanceRunnerArgs<DummyProvisionInputV1, DummyProvisionOutputV1> {
    dummyInfraManager: DummyInstanceInfraManager
}

/**
 * A Dummy instance runner that simulates the behavior of an instance.
 * 
 * Voluntarily does not extend AbstractInstanceRunner for simplicity
 * and to avoid having stubs removing desired behavior during tests
 */
export class DummyInstanceRunner implements InstanceRunner {

    private readonly logger: Logger
    private readonly args: DummyInstanceRunnerArgs

    constructor(args: DummyInstanceRunnerArgs) {
        this.logger = getLogger(args.instanceName)
        this.args = args
    }


    async start(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Dummy start operation for instance: ${this.args.instanceName} (starting time: ${this.args.provisionInput.startDelaySeconds} seconds)`)
        
        if(this.args.provisionInput.startDelaySeconds > 0) {
            await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Starting)
            const startingPromise = new Promise<void>(resolve => setTimeout(async () => {
                await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
                resolve()
            }, this.args.provisionInput.startDelaySeconds * 1000))
            
            if(opts?.wait) {
                await startingPromise
            }
        } else {
            await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
        }
    }

    async stop(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Dummy stop operation for instance: ${this.args.instanceName} (stopping time: ${this.args.provisionInput.stopDelaySeconds} seconds)`)

        if(this.args.provisionInput.stopDelaySeconds > 0) {
            await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopping)
            const stoppingPromise = new Promise<void>(resolve => setTimeout(async () => {
                await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
                resolve()
            }, this.args.provisionInput.stopDelaySeconds * 1000))
            
            if(opts?.wait) {
                await stoppingPromise
            }
        } else {
            await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
        }
    }

    async restart(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Dummy restart operation for instance: ${this.args.instanceName}`)
        await this.stop()
        await this.start()
    }

    async serverStatus(): Promise<ServerRunningStatus> {
        this.logger.debug(`Dummy get status operation for instance: ${this.args.instanceName}`)
        const status = await this.args.dummyInfraManager.getServerRunningStatus()
        return status.status
    }

    async pairInteractive(): Promise<void> {
        this.logger.debug(`Dummy pair interactive operation for instance: ${this.args.instanceName}`)
    }

    async pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean> {
        this.logger.debug(`Dummy pair send pin operation for instance: ${this.args.instanceName} with pin: ${pin}`)
        return true
    }

    /**
     * Dummy implementation of streaming server readiness. 
     * Returns true is current server status and delay after starting is greater than
     * configured readiness after start time.
     */
    async isStreamingServerReady(): Promise<boolean> {
        this.logger.trace(`Checking dummy readiness: ${this.args.instanceName}`)

        const status = await this.serverStatus()

        this.logger.trace(`Dummy instance ${this.args.instanceName} readiness - server status: ${status}`)

        if(status === ServerRunningStatus.Running) {
            if(this.args.provisionInput.readinessAfterStartDelaySeconds === undefined || this.args.provisionInput.readinessAfterStartDelaySeconds <= 0) {
                this.logger.trace(`Dummy instance ${this.args.instanceName} readiness result: true`)
                return true
            }

            const status = await this.args.dummyInfraManager.getServerRunningStatus()

            if(status.lastUpdate === undefined) {
                throw new Error(`Dummy instance ${this.args.instanceName} has a running server but not last update date. This should never happen.`)
            }

            const delaySinceLastServerStatusChangeMs = Date.now() - status.lastUpdate
            const isReady = delaySinceLastServerStatusChangeMs >= this.args.provisionInput.readinessAfterStartDelaySeconds * 1000
            
            this.logger.trace(`Dummy instance ${this.args.instanceName} readiness result: ${isReady} (delay since last server status update: ${delaySinceLastServerStatusChangeMs} ms)`)

            return isReady
        }

        this.logger.trace(`Dummy instance ${this.args.instanceName} readiness result: false`)
        return false
    }
}   