import { SshKeyLoader } from '../../tools/ssh';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';

export type DummyProvisionerArgs = InstanceProvisionerArgs<DummyProvisionInputV1, DummyProvisionOutputV1>

export class DummyProvisioner extends AbstractInstanceProvisioner<DummyProvisionInputV1, DummyProvisionOutputV1> {

    constructor(args: DummyProvisionerArgs){
        super(args)
    }

    async doProvision(opts?: InstanceProvisionOptions): Promise<DummyProvisionOutputV1> {

        this.logger.info(`Provisioning dummy instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Dummy instance with args ${JSON.stringify(this.args)} and options ${JSON.stringify(opts)}`)

        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

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

        return {
            host: `dummy-${this.args.instanceName}`,
            instanceId: `dummy-id-${this.args.instanceName}`
        }

    }

    async doDestroy(){
        this.logger.info(`Simulating destruction of dummy instance ${this.args.instanceName}`)
        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        this.logger.info(`Verifying dummy instance configuration for ${this.args.instanceName}`)
    }
}
