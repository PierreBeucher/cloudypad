import { SshKeyLoader } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { AwsPulumiClient, PulumiStackConfigAws } from './pulumi';
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
            const humanReadableArgs = (obj: any, parentKey = ''): string => {
                return Object.keys(obj).map(key => {
                    const fullKey = parentKey ? `${parentKey} ${key}` : key;
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        return humanReadableArgs(obj[key], fullKey);
                    }
                    return `${fullKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${obj[key]}`;
                }).join('\n    ');
            };

            confirmCreation = await confirm({
                message: `You are about to provision AWS machine with the following details:\n` + 
                `    ${this.inputToHumanReadableString(this.args)}` +
                `\nDo you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('AWS provision aborted.');
        }

        const pulumiClient = new AwsPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAws = {
            instanceType: this.args.provisionInput.instanceType,
            publicIpType: this.args.provisionInput.publicIpType,
            region: this.args.provisionInput.region,
            rootVolumeSizeGB: this.args.provisionInput.diskSize,
            publicSshKeyContent: new SshKeyLoader().parseSshPrivateKeyFileToPublic(this.args.provisionInput.ssh.privateKeyPath),
            useSpot: this.args.provisionInput.useSpot,
            billingAlert: this.args.provisionInput.costAlert ?? undefined,
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

        this.args.provisionOutput = undefined
        this.args.provisionOutput = undefined
    }

    async doVerifyConfig() {
        const client = new AwsClient(this.args.instanceName, this.args.provisionInput.region)
        await client.checkAuth()
    }
}
