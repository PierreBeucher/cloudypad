import { AbstractInstanceRunner, InstanceRunnerArgs, ServerRunningStatus, StartStopOptions } from '../../core/runner';
import { SshProvisionInputV1, SshProvisionOutputV1 } from './state';
import { SSHClient, SSHClientArgs } from '../../tools/ssh';
import { CLOUDYPAD_PROVIDER_SSH } from '../../core/const';

export interface SshInstanceRunnerArgs extends InstanceRunnerArgs<SshProvisionInputV1, SshProvisionOutputV1> {}

/**
 * A SSH instance runner that implements instance lifecycle operations.
 * For connecting to local machines or machines accessible via SSH.
 */
export class SshInstanceRunner extends AbstractInstanceRunner<SshProvisionInputV1, SshProvisionOutputV1> {

    constructor(args: SshInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_SSH, args);
    }

    protected buildSshClientArgs(): SSHClientArgs {
        const defaultArgs = super.buildSshClientArgs()

        this.logger.debug(`Building Local provider SSH client args for instance ${this.args.instanceName}`)

        return {
            ...defaultArgs,
            // this runner also support password auth, use it if provided
            password: this.args.provisionInput.ssh.passwordBase64 ? 
                Buffer.from(this.args.provisionInput.ssh.passwordBase64, 'base64').toString('utf-8') : undefined
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
        this.logger.debug(`Start via SSH for instance ${this.args.instanceName}`)
        
        // Try to use SSH if available
        await this.tryWithSshClient(async (sshClient) => {
            await sshClient.command(['docker', 'start', 'cloudy']);
        });
        
    }

    async doStop(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Stop via SSH for instance ${this.args.instanceName}`)

        await this.tryWithSshClient(async (sshClient) => {
            await sshClient.command(['docker', 'stop', 'cloudy']);
        });

    }

    async doRestart(opts?: StartStopOptions): Promise<void> {
        this.logger.debug(`Restart via SSH for instance ${this.args.instanceName}`)
        
        const sshSuccess = await this.tryWithSshClient(async (sshClient) => {
            await sshClient.command(['docker', 'restart', 'cloudy']);
        });
    }

    async doGetInstanceStatus(): Promise<ServerRunningStatus> {
        this.logger.debug(`SSH get status operation for instance: ${this.args.instanceName}`)
        
        // try to run an SSH command on instance
        // No error means instance is running properly
        try {
            await this.tryWithSshClient(async (sshClient) => {
                this.logger.debug(`Using SSH to check container status on ${this.args.instanceName}`);
                await sshClient.command(['echo', 'ok']);
            })
            return ServerRunningStatus.Running
        } catch (error) {
            this.logger.info(`SSH operation failed checking instance status. Considering instance is stopped.`);
            return ServerRunningStatus.Stopped;
        }
    }
}  