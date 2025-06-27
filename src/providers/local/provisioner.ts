import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner';
import { LocalProvisionInputV1, LocalProvisionOutputV1 } from './state';
import { ServerRunningStatus } from '../../core/runner';
import { LocalInstanceInfraManager } from './infra';

export interface LocalProvisionerArgs extends InstanceProvisionerArgs<LocalProvisionInputV1, LocalProvisionOutputV1> {
    localInfraManager: LocalInstanceInfraManager
}

export class LocalProvisioner extends AbstractInstanceProvisioner<LocalProvisionInputV1, LocalProvisionOutputV1> {

    private readonly localInfraManager: LocalInstanceInfraManager

    constructor(args: LocalProvisionerArgs){
        super(args)
        this.localInfraManager = args.localInfraManager
    }

    async doProvision(): Promise<LocalProvisionOutputV1> {

        this.logger.info(`Provisioning local instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Local instance with args ${JSON.stringify(this.args)}`)

        if(this.args.provisionInput.provisioningDelaySeconds && this.args.provisionInput.provisioningDelaySeconds > 0){
            const delay = this.args.provisionInput.provisioningDelaySeconds * 1000
            this.logger.debug(`Emulating provision delay of Local instance ${this.args.instanceName}: ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        this.logger.debug(`Provisioned Local instance ${this.args.instanceName}`)

        // Simulate some configuration setup
        const localConfig = {
            instanceType: this.args.provisionInput.instanceType,
            publicIpType: this.args.provisionInput.publicIpType,
            region: this.args.provisionInput.region,
            rootVolumeSizeGB: this.args.provisionInput.diskSize,
            useSpot: this.args.provisionInput.useSpot,
            billingAlert: this.args.provisionInput.costAlert ?? undefined,
            ingressPorts: this.getStreamingServerPorts()
        }

        if(this.args.provisionInput.initialServerStateAfterProvision === undefined || this.args.provisionInput.initialServerStateAfterProvision === "running"){
            await this.localInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
        } else {
            await this.localInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
        }

        // Use customHost if specified, otherwise use default "0.0.0.0"
        const host = this.args.provisionInput.customHost || "0.0.0.0";

        return {
            host: host,
            instanceId: `local-id-${this.args.instanceName}`,
            provisionedAt: Date.now(),
        }
    }

    async doDestroy(){
        this.logger.info(`Simulating destruction of local instance ${this.args.instanceName}`)
        this.args.provisionOutput = undefined
        await this.localInfraManager.setServerRunningStatus(ServerRunningStatus.Unknown)
    }

    async doVerifyConfig() {
        this.logger.info(`Verifying local instance configuration for ${this.args.instanceName}`)
    }
}
