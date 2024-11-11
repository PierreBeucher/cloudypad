import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { AwsPulumiClient, PulumiStackConfigAws } from '../../tools/pulumi/aws';
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner';
import { AwsClient } from '../../tools/aws';
import { AwsProvisionStateV1 } from './state';
import { CommonProvisionStateV1 } from '../../core/state';

export interface AwsProvisionerArgs {
    instanceName: string
    common: CommonProvisionStateV1
    aws: AwsProvisionStateV1
}

export class AwsProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    private readonly args: AwsProvisionerArgs

    constructor(args: AwsProvisionerArgs){
        super({ instanceName: args.instanceName})
        this.args = args
    }

    async provision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning AWS instance ${this.args.instanceName}`)

        const awsConfig = this.args.aws.config

        if(!opts?.skipAuthCheck){
            await this.checkAwsAuth(awsConfig.region)
        }

        this.logger.debug(`Provisioning AWS instance with ${JSON.stringify(this.args)}`)

        let confirmCreation: boolean
        if(opts?.autoApprove){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision AWS machine with the following details:
    Instance name: ${this.args.instanceName}
    Spot instance: ${awsConfig.useSpot}
    SSH key: ${this.args.common.config.ssh.privateKeyPath}
    AWS Region: ${awsConfig.region}
    Instance Type: ${awsConfig.instanceType}
    Public IP Type: ${awsConfig.publicIpType}
    Disk size: ${awsConfig.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('AWS provision aborted.');
        }

        const pulumiClient = new AwsPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAws = {
            instanceType: awsConfig.instanceType,
            publicIpType: awsConfig.publicIpType,
            region: awsConfig.region,
            rootVolumeSizeGB: awsConfig.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.common.config.ssh.privateKeyPath),
            useSpot: awsConfig.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        this.args.aws.output = {
            instanceId: pulumiOutputs.instanceId
        }

        this.args.common.output = {
            host: pulumiOutputs.publicIp
        }
    }

    async destroy(){

        this.logger.info(`Destroying instance: ${this.args.instanceName}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy AWS instance '${this.args.instanceName}'. Please confirm:`,
            default: false,
        });

        if (!confirmCreation) {
            throw new Error('Destroy aborted.');
        }

        const pulumiClient = new AwsPulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.aws.output = undefined
        this.args.common.output = undefined
    }

    async checkAwsAuth(region: string) {
        const client = new AwsClient(this.args.instanceName, region)
        await client.checkAuth()
    }
}
