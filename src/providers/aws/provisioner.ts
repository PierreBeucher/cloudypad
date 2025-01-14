import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { AwsPulumiClient, PulumiStackConfigAws } from '../../tools/pulumi/aws';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner';
import { AwsClient } from '../../tools/aws';
import { AwsProvisionInputV1, AwsProvisionOutputV1 } from './state';

export type AwsProvisionerArgs = InstanceProvisionerArgs<AwsProvisionInputV1, AwsProvisionOutputV1>

export class AwsProvisioner extends AbstractInstanceProvisioner<AwsProvisionInputV1, AwsProvisionOutputV1> {

    constructor(args: AwsProvisionerArgs){
        super(args)
    }

    async doProvision(opts?: InstanceProvisionOptions): Promise<AwsProvisionOutputV1> {

        this.logger.info(`Provisioning AWS instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning AWS instance with args ${JSON.stringify(this.args)} and options ${JSON.stringify(opts)}`)

        let confirmCreation: boolean
        if(opts?.autoApprove){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision AWS machine with the following details:
    Instance name: ${this.args.instanceName}
    Spot instance: ${this.args.input.useSpot}
    SSH key: ${this.args.input.ssh.privateKeyPath}
    AWS Region: ${this.args.input.region}
    Instance Type: ${this.args.input.instanceType}
    Public IP Type: ${this.args.input.publicIpType}
    Disk size: ${this.args.input.diskSize}
    Cost Alert: ${this.args.input.costAlert?.limit ? `enabled, limit: ${this.args.input.costAlert.limit}$, ` + 
        `notification email: ${this.args.input.costAlert.notificationEmail}` : 'None.'}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('AWS provision aborted.');
        }

        const pulumiClient = new AwsPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAws = {
            instanceType: this.args.input.instanceType,
            publicIpType: this.args.input.publicIpType,
            region: this.args.input.region,
            rootVolumeSizeGB: this.args.input.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.input.ssh.privateKeyPath),
            useSpot: this.args.input.useSpot,
            billingAlert: this.args.input.costAlert ? {
                limit: this.args.input.costAlert.limit.toString(),
                notificationEmail: this.args.input.costAlert.notificationEmail
            } : undefined
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            host: pulumiOutputs.publicIp,
            instanceId: pulumiOutputs.instanceId
        }

    }

    async doDestroy(){
        const pulumiClient = new AwsPulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.output = undefined
        this.args.output = undefined
    }

    async doVerifyConfig() {
        const client = new AwsClient(this.args.instanceName, this.args.input.region)
        await client.checkAuth()
    }
}
