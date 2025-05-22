import { InstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { getLogger, Logger } from '../../log/utils';
import { DummyInstanceInfraManager } from './infra';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';
import { SSHClient } from '../../tools/ssh';

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

    private buildSshClient(): SSHClient | null {
        // Check if auth type is password
        if ((this.args.provisionInput as any).auth && (this.args.provisionInput as any).auth.type === "password") {
            const auth = (this.args.provisionInput as any).auth;
            const customHost = (this.args.provisionInput as any).customHost || "0.0.0.0";
            
            const sshConfig: any = {
                clientName: "DummyInstanceRunner",
                host: customHost,
                port: 22,
                user: auth.ssh.user,
                password: auth.ssh.password
            };
            
            return new SSHClient(sshConfig);
        }
        return null;
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

    async start(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Dummy start operation for instance: ${this.args.instanceName} (starting time: ${this.args.provisionInput.startDelaySeconds} seconds)`)
        
        // Try to use SSH if available
        await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to start services on ${this.args.instanceName}`);
            // Start Docker service and Sunshine container
            await sshClient.command(['sudo', 'systemctl', 'start', 'docker']);
            // Try to start existing container first, if it fails, just continue
            try {
                await sshClient.command(['docker', 'start', 'cloudy']);
            } catch (error) {
                this.logger.warn(`Failed to start cloudy container, might not exist yet: ${error}`);
            }
        });
        
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

        // Try to use SSH if available
        await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to stop services on ${this.args.instanceName}`);
            // Stop sunshine container
            await sshClient.command(['docker', 'stop', 'cloudy']);
        });

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
        
        // Try to use SSH if available
        const sshSuccess = await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to restart services on ${this.args.instanceName}`);
            // Restart sunshine container
            await sshClient.command(['docker', 'restart', 'cloudy']);
        });
        
        // If SSH failed, fall back to stop/start
        if (!sshSuccess) {
            await this.stop(opts);
            await this.start(opts);
        }
    }

    async serverStatus(): Promise<ServerRunningStatus> {
        this.logger.debug(`Dummy get status operation for instance: ${this.args.instanceName}`)
        
        // Try to check actual status via SSH if available
        let sshStatus: ServerRunningStatus | null = null;
        
        await this.tryWithSshClient(async (sshClient) => {
            this.logger.debug(`Using SSH to check container status on ${this.args.instanceName}`);
            const result = await sshClient.command(['docker', 'ps', '--filter', 'name=cloudy', '--format', '{{.Status}}']);
            if (result.stdout && result.stdout.includes('Up')) {
                await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running);
                sshStatus = ServerRunningStatus.Running;
            } else {
                await this.args.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped);
                sshStatus = ServerRunningStatus.Stopped;
            }
        });
        
        if (sshStatus !== null) {
            return sshStatus;
        }
        
        const status = await this.args.dummyInfraManager.getServerRunningStatus()
        return status.status
    }

    async pairInteractive(): Promise<void> {
        this.logger.debug(`Dummy pair interactive operation for instance: ${this.args.instanceName}`)
        
        // If we have SSH access, try to check if Sunshine is actually running
        const sshClient = this.buildSshClient();
        if (sshClient) {
            try {
                // Check if the Sunshine container is running
                const result = await sshClient.command(['docker', 'ps', '--filter', 'name=cloudy', '--format', '{{.Status}}']);
                if (!result.stdout || !result.stdout.includes('Up')) {
                    this.logger.warn(`Sunshine container is not running. Starting it...`);
                    await this.start({ wait: true });
                }
                
                // Generate a PIN and provide instructions
                const pin = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit PIN
                
                const host = (this.args.provisionInput as any).customHost || "0.0.0.0";
                
                console.info(`Run this command in another terminal to pair your instance:`)
                console.info()
                console.info(`  moonlight pair ${host} --pin ${pin}`)
                console.info()
                console.info(`For Mac / Apple devices, you may need to use this pseudo-IPv6 address:`)
                console.info()
                console.info(`  moonlight pair [::ffff:${host}] --pin ${pin}`)
                console.info()
                
                // Try to send the PIN to Sunshine
                console.info(`Sending PIN to Sunshine API...`)
                
                // Use curl via SSH to send the PIN to Sunshine
                const username = this.args.configurationInput.sunshine?.username || "admin";
                const passwordBase64 = this.args.configurationInput.sunshine?.passwordBase64 || "";
                const password = Buffer.from(passwordBase64, 'base64').toString('utf-8');
                
                let success = false;
                let attempts = 0;
                const maxAttempts = 30;
                
                while (!success && attempts < maxAttempts) {
                    try {
                        const pairResult = await sshClient.command([
                            'curl',
                            '-v',
                            '-u',
                            `${username}:${password}`,
                            '-X',
                            'POST',
                            '-k',
                            'https://localhost:47990/api/pin',
                            '-d',
                            `{"pin":"${pin}","name":"${this.args.instanceName}"}`
                        ]);
                        
                        this.logger.debug(`Sunshine pair attempt ${attempts + 1} result: ${pairResult.stdout}`);
                        
                        if (pairResult.stdout && pairResult.stdout.includes('"status":"true"')) {
                            success = true;
                            console.info(`✅ PIN sent successfully! Continue with Moonlight pairing.`);
                        } else {
                            attempts++;
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    } catch (error) {
                        this.logger.warn(`Failed to send PIN attempt ${attempts + 1}: ${error}`);
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                
                if (!success) {
                    console.info(`❌ Failed to send PIN after ${maxAttempts} attempts. Please check if Sunshine is running correctly.`);
                }
            } catch (error) {
                this.logger.warn(`Failed to execute pairing via SSH: ${error}`);
            }
        }
    }

    async pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean> {
        this.logger.debug(`Dummy pair send pin operation for instance: ${this.args.instanceName} with pin: ${pin}`);
        
        // If we have SSH access, try to send the PIN to Sunshine
        const sshClient = this.buildSshClient();
        if (sshClient) {
            try {
                // Use curl via SSH to send the PIN to Sunshine
                const username = this.args.configurationInput.sunshine?.username || "admin";
                const passwordBase64 = this.args.configurationInput.sunshine?.passwordBase64 || "";
                const password = Buffer.from(passwordBase64, 'base64').toString('utf-8');
                
                const pairResult = await sshClient.command([
                    'curl',
                    '-v',
                    '-u',
                    `${username}:${password}`,
                    '-X',
                    'POST',
                    '-k',
                    'https://localhost:47990/api/pin',
                    '-d',
                    `{"pin":"${pin}","name":"${this.args.instanceName}"}`
                ]);
                
                this.logger.debug(`Sunshine pair result: ${pairResult.stdout}`);
                
                if (pairResult.stdout && pairResult.stdout.includes('"status":"true"')) {
                    return true;
                }
            } catch (error) {
                this.logger.warn(`Failed to send PIN: ${error}`);
            }
        }
        
        return false;
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
            // Check actual readiness via SSH if available
            const sshClient = this.buildSshClient();
            if (sshClient) {
                try {
                    // Use cloudypad-check-readiness script to check if Sunshine is ready
                    const result = await sshClient.command(['cloudypad-check-readiness']);
                    this.logger.debug(`Sunshine readiness check result: ${result.stdout}`);
                    if (result.code === 0) {
                        this.logger.debug(`Sunshine is ready according to cloudypad-check-readiness`);
                        return true;
                    }
                } catch (error) {
                    this.logger.warn(`Failed to check readiness via SSH: ${error}`);
                    // Fall back to standard logic
                }
            }
            
            if(this.args.provisionInput.readinessAfterStartDelaySeconds === undefined || this.args.provisionInput.readinessAfterStartDelaySeconds <= 0) {
                this.logger.trace(`Dummy instance ${this.args.instanceName} readiness result: true`)
                return true
            }

            const status = await this.args.dummyInfraManager.getServerRunningStatus()
            const delaySinceLastServerStatusChangeMs = Date.now() - status.lastUpdate
            const isReady = delaySinceLastServerStatusChangeMs >= this.args.provisionInput.readinessAfterStartDelaySeconds * 1000
            
            this.logger.trace(`Dummy instance ${this.args.instanceName} readiness result: ${isReady} (delay since last server status update: ${delaySinceLastServerStatusChangeMs} ms)`)

            return isReady
        }

        this.logger.trace(`Dummy instance ${this.args.instanceName} readiness result: false`)
        return false
    }
}   