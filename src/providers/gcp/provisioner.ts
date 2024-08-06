import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner';
import { StateManager } from '../../core/state';
import { GcpPulumiClient, PulumiStackConfigGcp } from '../../tools/pulumi/gcp';
import { GcpClient } from '../../tools/gcp';

export class GcpProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    constructor(sm: StateManager){
        super(sm)
    }

    async provision(opts: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Google Cloud instance ${this.sm.name()}`)

        const state = this.sm.get()
        if(!state.provider?.gcp) {
            throw new Error(`Missing Google Cloud provider in state ${JSON.stringify(state)}`)
        }

        if(!state.provider?.gcp?.provisionArgs) {
            throw new Error(`Missing Google Cloud provision args in state ${JSON.stringify(state)}`)
        }

        const args = state.provider.gcp.provisionArgs

        if (!state.ssh?.privateKeyPath) {
            throw new Error(`Provisioning Google Cloud instance requires a private SSH key. Got state: ${JSON.stringify(state)}`)
        }

        if(!opts.skipAuthCheck){
            await this.checkGcpAuth(state.provider.gcp.provisionArgs.create.projectId)
        }

        this.logger.debug(`Provisioning Google Cloud instance with ${JSON.stringify(state)}`)

        if (args.create){
            
            let confirmCreation: boolean
            if(opts.autoApprove){
                confirmCreation = opts.autoApprove
            } else {
                confirmCreation = await confirm({
                    message: `
    You are about to provision Google Cloud machine with the following details:
        Instance name: ${state.name}
        SSH key: ${state.ssh.privateKeyPath}
        Region: ${args.create.region}
        Project ID: ${args.create.projectId}
        Machine Type: ${args.create.machineType}
        GPU Type: ${args.create.acceleratorType}
        Public IP Type: ${args.create.publicIpType}
        Disk size: ${args.create.diskSize}
        
    Do you want to proceed?`,
                    default: true,
                })
            }

            if (!confirmCreation) {
                throw new Error('Google Cloud provision aborted.');
            }

            await this.sm.update({
                status: {
                    initalized: true
                },
                provider: {
                    gcp: {}
                }
            })

            const pulumiClient = new GcpPulumiClient(state.name)
            const pulumiConfig: PulumiStackConfigGcp = {
                machineType: args.create.machineType,
                acceleratorType: args.create.acceleratorType,
                projectId: args.create.projectId,
                publicIpType: args.create.publicIpType,
                region: args.create.region,
                zone: args.create.zone,
                rootDiskSize: args.create.diskSize,
                publicSshKeyContent: await parseSshPrivateKeyFileToPublic(state.ssh.privateKeyPath)
            }

            await pulumiClient.setConfig(pulumiConfig)
            const pulumiOutputs = await pulumiClient.up()

            await this.sm.update({
                host: pulumiOutputs.publicIp,
                provider: {
                    gcp: {
                        instanceName: pulumiOutputs.instanceName
                    }
                }
            })
        } else {
            throw new Error(`Provisioning Google Cloud requires creation of new instance, got ${JSON.stringify(args)}`)
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
            message: `You are about to destroy GCP instance '${state.name}'. Please confirm:`,
            default: false,
        });

        if (!confirmCreation) {
            throw new Error('Destroy aborted.');
        }

        const pulumiClient = new GcpPulumiClient(state.name)
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

    private async checkGcpAuth(projectId: string) {
        const client = new GcpClient(this.sm.name(), projectId)
        await client.checkGcpAuth()
    }
}
