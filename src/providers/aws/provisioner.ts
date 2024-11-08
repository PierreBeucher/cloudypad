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

        const state = this.sm.get()
        if(!state.provider?.aws) {
            throw new Error(`Missing AWS provider in state ${JSON.stringify(state)}`)
        }

        if(!state.provider?.aws?.provisionArgs) {
            throw new Error(`Missing AWS provision args in state ${JSON.stringify(state)}`)
        }

        const args = state.provider.aws.provisionArgs

        if (!state.ssh?.privateKeyPath) {
            throw new Error(`Provisioning AWS instance requires a private SSH key. Got state: ${JSON.stringify(state)}`)
        }

        if(!args.create){
            throw new Error(`Missing AWS provisioning parameter. Got state: ${JSON.stringify(state)}`)
        }

        if(!opts?.skipAuthCheck){
            await this.checkAwsAuth(args.create.region)
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
    Spot instance: ${args.create.useSpot}
    SSH key: ${state.ssh.privateKeyPath}
    AWS Region: ${args.create.region}
    Instance Type: ${args.create.instanceType}
    Public IP Type: ${args.create.publicIpType}
    Disk size: ${args.create.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('AWS provision aborted.');
        }

        await this.sm.update({
            status: {
                initalized: true
            },
            provider: {
                aws: {}
            }
        })

        const pulumiClient = new AwsPulumiClient(state.name)
        const pulumiConfig: PulumiStackConfigAws = {
            instanceType: args.create.instanceType,
            publicIpType: args.create.publicIpType,
            region: args.create.region,
            rootVolumeSizeGB: args.create.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(state.ssh.privateKeyPath),
            useSpot: args.create.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        await this.sm.update({
            host: pulumiOutputs.publicIp,
            provider: {
                aws: {
                    instanceId: pulumiOutputs.instanceId
                }
            }
        })

        await this.sm.update({
            status: {
                provision: {
                    provisioned: true,
                    lastUpdate: Date.now()
                }
            }
        })
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

        this.sm.update({
            status: {
                configuration: {
                    configured: false,
                    lastUpdate: Date.now()
                },
                provision: {
                    provisioned: false,
                    lastUpdate: Date.now()
                }
            }
        })

    }

    async checkAwsAuth(region: string) {
        const client = new AwsClient(this.sm.name(), region)
        await client.checkAuth()
    }
}
