import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { LocalInstanceInfraManager } from './infra';
import { LocalProvisionInputV1, LocalProvisionOutputV1 } from './state';
import { SSHClient, SshKeyLoader } from '../../tools/ssh';
import { CLOUDYPAD_PROVIDER_LOCAL } from '../../core/const';
import { buildSshClientArgsForInstance } from '../../tools/ssh';

export interface LocalInstanceRunnerArgs extends InstanceRunnerArgs<LocalProvisionInputV1, LocalProvisionOutputV1> {
    localInfraManager: LocalInstanceInfraManager
}

/**
 * A Local instance runner that implements instance lifecycle operations.
 * For connecting to local machines or machines accessible via SSH.
 */
export class LocalInstanceRunner extends AbstractInstanceRunner<LocalProvisionInputV1, LocalProvisionOutputV1> {

    private readonly localArgs: LocalInstanceRunnerArgs

    constructor(args: LocalInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_LOCAL, args);
        this.localArgs = args
    }

    private buildSshClient(): SSHClient | null {
        // Use the same logic as buildSshClientArgsForInstance for consistency
        try {
            const sshClientArgs = buildSshClientArgsForInstance({
                instanceName: this.localArgs.instanceName,
                provisionInput: this.localArgs.provisionInput as any,
                provisionOutput: this.localArgs.provisionOutput as any
            });
            
            return new SSHClient(sshClientArgs);
        } catch (error) {
            this.logger.warn(`Failed to build SSH client: ${error}`);
            return null;
        }
    }

    private async tryWithSshClient(action: (client: SSHClient) => Promise<void>): Promise<boolean> {
        const sshClient = this.buildSshClient();
        if (!sshClient) {
            return false;
        }
        
        try {
            this.logger.debug(`Connecting to SSH server...`);
            await sshClient.connect();
            await action(sshClient);
            return true;
        } catch (error) {
            this.logger.warn(`SSH operation failed: ${error}`);
            return false;
        } finally {
            sshClient.dispose();
        }
    }

    async doStart(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Local start operation for instance: ${this.localArgs.instanceName} (starting time: ${this.localArgs.provisionInput.startDelaySeconds} seconds)`)
        
        // Try to use SSH if available
        await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to start services on ${this.localArgs.instanceName}`);
            // Start Docker service and Sunshine container
            await sshClient.command(['sudo', 'systemctl', 'start', 'docker']);
            // Try to start existing container first, if it fails, just continue
            try {
                await sshClient.command(['docker', 'start', 'cloudy']);
            } catch (error) {
                this.logger.warn(`Failed to start cloudy container, might not exist yet: ${error}`);
            }
        });
        
        if(this.localArgs.provisionInput.startDelaySeconds > 0) {
            await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Starting)
            const startingPromise = new Promise<void>(resolve => setTimeout(async () => {
                await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
                resolve()
            }, this.localArgs.provisionInput.startDelaySeconds * 1000))
            
            if(opts?.wait) {
                await startingPromise
            }
        } else {
            await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
        }
    }

    async doStop(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Local stop operation for instance: ${this.localArgs.instanceName} (stopping time: ${this.localArgs.provisionInput.stopDelaySeconds} seconds)`)

        // Try to use SSH if available
        await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to stop services on ${this.localArgs.instanceName}`);
            // Stop sunshine container
            await sshClient.command(['docker', 'stop', 'cloudy']);
        });

        if(this.localArgs.provisionInput.stopDelaySeconds > 0) {
            await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Stopping)
            const stoppingPromise = new Promise<void>(resolve => setTimeout(async () => {
                await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
                resolve()
            }, this.localArgs.provisionInput.stopDelaySeconds * 1000))
            
            if(opts?.wait) {
                await stoppingPromise
            }
        } else {
            await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
        }
    }

    async doRestart(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Local restart operation for instance: ${this.localArgs.instanceName}`)
        
        // Try to use SSH if available
        const sshSuccess = await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to restart services on ${this.localArgs.instanceName}`);
            // Restart sunshine container
            await sshClient.command(['docker', 'restart', 'cloudy']);
        });
        
        // If SSH failed, fall back to stop/start
        if (!sshSuccess) {
            await this.doStop(opts);
            await this.doStart(opts);
        }
    }

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        this.logger.debug(`Local get status operation for instance: ${this.localArgs.instanceName}`)
        
        // Try to check actual status via SSH if available
        let sshStatus: ServerRunningStatus | null = null;
        
        await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to check container status on ${this.localArgs.instanceName}`);
            const result = await sshClient.command(['docker', 'ps', '--filter', 'name=cloudy', '--format', '{{.Status}}']);
            if (result.stdout && result.stdout.includes('Up')) {
                await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Running);
                sshStatus = ServerRunningStatus.Running;
            } else {
                await this.localArgs.localInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped);
                sshStatus = ServerRunningStatus.Stopped;
            }
        });
        
        if (sshStatus !== null) {
            return sshStatus;
        }
        
        const status = await this.localArgs.localInfraManager.getServerRunningStatus()
        return status.status
    }



    /**
     * Local implementation of streaming server readiness. 
     * Returns true is current server status and delay after starting is greater than
     * configured readiness after start time.
     */
    async isStreamingServerReady(): Promise<boolean> {
        this.logger.trace(`Checking local readiness: ${this.localArgs.instanceName}`)

        const status = await this.serverStatus()

        this.logger.trace(`Local instance ${this.localArgs.instanceName} readiness - server status: ${status}`)

        if(status === ServerRunningStatus.Running) {
            // Check actual readiness via SSH if available
            let sshReadinessResult: boolean | null = null;
            
            await this.tryWithSshClient(async (sshClient) => {
                // Use cloudypad-check-readiness script to check if Sunshine is ready
                const result = await sshClient.command(['cloudypad-check-readiness'], { ignoreNonZeroExitCode: true });
                this.logger.debug(`Sunshine readiness check result: ${result.stdout}`);
                if (result.code === 0) {
                    this.logger.debug(`Sunshine is ready according to cloudypad-check-readiness`);
                    sshReadinessResult = true;
                } else {
                    sshReadinessResult = false;
                }
            });
            
            if (sshReadinessResult === true) {
                return true;
            }
            
            if(this.localArgs.provisionInput.readinessAfterStartDelaySeconds === undefined || this.localArgs.provisionInput.readinessAfterStartDelaySeconds <= 0) {
                this.logger.trace(`Local instance ${this.localArgs.instanceName} readiness result: true`)
                return true
            }

            const status = await this.localArgs.localInfraManager.getServerRunningStatus()
            const delaySinceLastServerStatusChangeMs = Date.now() - status.lastUpdate
            const isReady = delaySinceLastServerStatusChangeMs >= this.localArgs.provisionInput.readinessAfterStartDelaySeconds * 1000
            
            this.logger.trace(`Local instance ${this.localArgs.instanceName} readiness result: ${isReady} (delay since last server status update: ${delaySinceLastServerStatusChangeMs} ms)`)

            return isReady
        }

        this.logger.trace(`Local instance ${this.localArgs.instanceName} readiness result: false`)
        return false
    }
}  