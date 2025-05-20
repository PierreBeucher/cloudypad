import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';
import { ServerRunningStatus } from '../../core/runner';
import { DummyInstanceInfraManager } from './infra';

export interface DummyProvisionerArgs extends InstanceProvisionerArgs<DummyProvisionInputV1, DummyProvisionOutputV1> {
    dummyInfraManager: DummyInstanceInfraManager
}

export class DummyProvisioner extends AbstractInstanceProvisioner<DummyProvisionInputV1, DummyProvisionOutputV1> {

    private readonly dummyInfraManager: DummyInstanceInfraManager

    constructor(args: DummyProvisionerArgs){
        super(args)
        this.dummyInfraManager = args.dummyInfraManager
    }

    async doProvision(): Promise<DummyProvisionOutputV1> {

        this.logger.info(`Provisioning dummy instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Dummy instance with args ${JSON.stringify(this.args)}`)

        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        if(this.args.provisionInput.provisioningDelaySeconds && this.args.provisionInput.provisioningDelaySeconds > 0){
            const delay = this.args.provisionInput.provisioningDelaySeconds * 1000
            this.logger.debug(`Emulating provision delay of Dummy instance ${this.args.instanceName}: ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        this.logger.debug(`Provisioned Dummy instance ${this.args.instanceName}`)

        // Simulate some configuration setup
        const dummyConfig = {
            instanceType: this.args.provisionInput.instanceType,
            publicIpType: this.args.provisionInput.publicIpType,
            region: this.args.provisionInput.region,
            rootVolumeSizeGB: this.args.provisionInput.diskSize,
            publicSshKeyContent: sshPublicKeyContent,
            useSpot: this.args.provisionInput.useSpot,
            billingAlert: this.args.provisionInput.costAlert ?? undefined,
            ingressPorts: this.getStreamingServerPorts()
        }

        if(this.args.provisionInput.initialServerStateAfterProvision === undefined || this.args.provisionInput.initialServerStateAfterProvision === "running"){
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running)
        } else {
            await this.dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Stopped)
        }

        return {
            host: "0.0.0.0",
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
