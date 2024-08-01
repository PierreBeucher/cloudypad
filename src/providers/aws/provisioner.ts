import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { AwsPulumiClient, PulumiStackConfigAws } from '../../tools/pulumi/aws';
import { BaseInstanceProvisioner, InstanceProvisioner } from '../../core/provisioner';
import { StateManager } from '../../core/state';

export class AwsProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    constructor(sm: StateManager){
        super(sm)
    }

    async provision() {

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

        if(!args.skipAuthCheck){
            await this.checkAwsAuth()
        }

        if (args.create){

            const confirmCreation = await confirm({
                message: `
You are about to provision AWS machine with the following details:
    Instance name: ${state.name}
    SSH key: ${state.ssh.privateKeyPath}
    AWS Region: ${args.create.region}
    Instance Type: ${args.create.instanceType}
    Public IP Type: ${args.create.publicIpType}
    Disk size: ${args.create.diskSize}
    
Do you want to proceed?`,
                default: true,
            });

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
                publicSshKeyContent: await parseSshPrivateKeyFileToPublic(state.ssh.privateKeyPath)
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
        } else {
            throw new Error(`Provisioning AWS requires creation of new instance, got ${JSON.stringify(args)}`)
        }

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

    private async checkAwsAuth() {
        const stsClient = new STSClient({});
        try {
            const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));
            this.logger.info(`Currently authenticated as ${callerIdentity.UserId} on account ${callerIdentity.Account}`)
        } catch (e) {
            throw new Error(`Couldn't check AWS authentication: ${JSON.stringify(e)}`)
        }
    }
}
