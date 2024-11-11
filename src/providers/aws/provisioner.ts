import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { AwsPulumiClient, PulumiStackConfigAws } from '../../tools/pulumi/aws';
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner';
import { StateManager } from '../../core/state';
import { AwsClient } from '../../tools/aws';

export class AwsProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    constructor(sm: StateManager){
        super(sm)
    }

    async provision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning AWS instance ${this.sm.name()}`)

        // TODO should take as args the final arguments expected instead of relying on IF
        const state = this.sm.get()
        if(!state.provision.aws) {
            throw new Error(`Missing AWS provider in state ${JSON.stringify(state)}`)
        }

        const args = state.provision.aws.config

        if(!opts?.skipAuthCheck){
            await this.checkAwsAuth(args.region)
        }

        this.logger.debug(`Provisioning AWS instance with ${JSON.stringify(state)}`)

        let confirmCreation: boolean
        if(opts?.autoApprove){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision AWS machine with the following details:
    Instance name: ${state.name}
    Spot instance: ${args.useSpot}
    SSH key: ${state.provision.common.config.ssh.privateKeyPath}
    AWS Region: ${args.region}
    Instance Type: ${args.instanceType}
    Public IP Type: ${args.publicIpType}
    Disk size: ${args.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('AWS provision aborted.');
        }

        const pulumiClient = new AwsPulumiClient(state.name)
        const pulumiConfig: PulumiStackConfigAws = {
            instanceType: args.instanceType,
            publicIpType: args.publicIpType,
            region: args.region,
            rootVolumeSizeGB: args.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(state.provision.common.config.ssh.privateKeyPath),
            useSpot: args.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        state.provision.aws.state = {
            instanceId: pulumiOutputs.instanceId
        }

        state.provision.common.state = {
            host: pulumiOutputs.publicIp
        }

        this.sm.update(state)
    }

    async destroy(){
        const state = this.sm.get()

        this.logger.info(`Destroying instance: ${this.sm.name()}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy AWS instance '${state.name}'. Please confirm:`,
            default: false,
        });

        if (!confirmCreation) {
            throw new Error('Destroy aborted.');
        }

        const pulumiClient = new AwsPulumiClient(state.name)
        await pulumiClient.destroy()

        if(state.provision.aws) {
            state.provision.aws.state = undefined
        }
        state.provision.common.state = undefined
        
        this.sm.update(state)

    }

    async checkAwsAuth(region: string) {
        const client = new AwsClient(this.sm.name(), region)
        await client.checkAuth()
    }
}
