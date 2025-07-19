import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner';
import { SshProvisionInputV1, SshProvisionOutputV1 } from './state';

export interface SshProvisionerArgs extends InstanceProvisionerArgs<SshProvisionInputV1, SshProvisionOutputV1> { }

export class SshProvisioner extends AbstractInstanceProvisioner<SshProvisionInputV1, SshProvisionOutputV1> {

    constructor(args: SshProvisionerArgs){
        super(args)
    }

    async doProvision(): Promise<SshProvisionOutputV1> {

        this.logger.info(`Provisioning local instance ${this.args.instanceName} is a no-op, no action done but setting provision outputs.`)

        return {
            provisionedAt: new Date().getTime(),
            host: this.args.provisionInput.hostname,
        }
    }

    async doDestroy(){
        this.logger.info(`SSH provider destroy is a no-op, no action done. Provision output will be set to undefined.`)
        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        this.logger.info(`Verifying local instance configuration for ${this.args.instanceName}`)
    }
}
