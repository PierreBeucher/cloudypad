import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner';
import { LocalProvisionInputV1, LocalProvisionOutputV1 } from './state';

export interface LocalProvisionerArgs extends InstanceProvisionerArgs<LocalProvisionInputV1, LocalProvisionOutputV1> { }

export class LocalProvisioner extends AbstractInstanceProvisioner<LocalProvisionInputV1, LocalProvisionOutputV1> {

    constructor(args: LocalProvisionerArgs){
        super(args)
    }

    async doProvision(): Promise<LocalProvisionOutputV1> {

        this.logger.info(`Provisioning local instance ${this.args.instanceName} is a no-op, no action done but setting provision outputs.`)

        return {
            provisionedAt: new Date().getTime(),
            host: this.args.provisionInput.hostname,
        }
    }

    async doDestroy(){
        this.logger.info(`Local provider destroy is a no-op, no action done. Provision output will be set to undefined.`)
        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        this.logger.info(`Verifying local instance configuration for ${this.args.instanceName}`)
    }
}
