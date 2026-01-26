import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';
import { ServerRunningStatus } from '../../core/runner';
import { DummyInstanceInfraManager } from './infra';
import { objectOutputType, objectUtil, ZodString, ZodOptional, ZodNumber, ZodTypeAny } from 'zod';
import { INSTANCE_SERVER_STATE_ABSENT } from '../../core/const';

export interface DummyProvisionerArgs extends InstanceProvisionerArgs<DummyProvisionInputV1, DummyProvisionOutputV1> {
    dummyInfraManager: DummyInstanceInfraManager
}

export class DummyProvisioner extends AbstractInstanceProvisioner<DummyProvisionInputV1, DummyProvisionOutputV1> {

    private readonly dummyInfraManager: DummyInstanceInfraManager

    constructor(args: DummyProvisionerArgs){
        super(args)
        this.dummyInfraManager = args.dummyInfraManager
    }

    /**
     * Data snapshot provision for Dummy provider.
     * Dummy provider does not support data disk snapshots, returns current output as-is.
     */
    async doDataSnapshotProvision(): Promise<DummyProvisionOutputV1> {
        this.logger.debug(`Data snapshot provision for Dummy instance ${this.args.instanceName} (no-op)`)
        return {
            host: this.args.provisionOutput?.host ?? `dummy-${this.args.instanceName}`,
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            instanceId: this.args.provisionOutput?.instanceId,
            provisionedAt: Date.now(),
        }
    }

    /**
     * Main provision for Dummy provider.
     */
    async doMainProvision(): Promise<DummyProvisionOutputV1> {

        this.logger.info(`Main provision for Dummy instance ${this.args.instanceName}`)

        this.logger.debug(`Main provision Dummy instance with args ${JSON.stringify(this.args)}`)

        // Handle runtime state: enableInstanceServer
        // Only delete if explicitly set to absent
        if (this.args.provisionInput.runtime?.instanceServerState === INSTANCE_SERVER_STATE_ABSENT) {
            this.logger.info(`Destroying dummy instance server (enableInstanceServer=false)`)
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Unknown)
            return {
                host: `dummy-${this.args.instanceName}`,
                publicIPv4: `127.0.0.1`,
                instanceId: undefined, // Server doesn't exist
                provisionedAt: Date.now(),
            }
        }

        // unused var, just to check function works
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        if(this.args.provisionInput.provisioningDelaySeconds && this.args.provisionInput.provisioningDelaySeconds > 0){
            const delay = this.args.provisionInput.provisioningDelaySeconds * 1000
            this.logger.debug(`Emulating provision delay of Dummy instance ${this.args.instanceName}: ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        this.logger.debug(`Provisioned Dummy instance ${this.args.instanceName}`)

        if(this.args.provisionInput.initialServerStateAfterProvision === undefined || 
            this.args.provisionInput.initialServerStateAfterProvision === "running"
        ){
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
        } else {
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
        }

        return {
            host: `dummy-${this.args.instanceName}`,
            publicIPv4: `127.0.0.1`,
            instanceId: `dummy-id-${this.args.instanceName}`,
            provisionedAt: Date.now(),
        }

    }

    async doDestroy(){
        this.logger.info(`Simulating destruction of dummy instance ${this.args.instanceName}`)
        this.args.provisionOutput = undefined
        await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Unknown)
    }

    async doVerifyConfig() {
        this.logger.info(`Verifying dummy instance configuration for ${this.args.instanceName}`)
    }
}
