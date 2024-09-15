import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from '../../tools/pulumi/azure'
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner'
import { StateManager } from '../../core/state'
import { AzureClient } from '../../tools/azure'

export class AzureProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    constructor(sm: StateManager) {
        super(sm)
    }

    async provision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Azure instance ${this.sm.name()}`)

        const state = this.sm.get()
        if (!state.provider?.azure) {
            throw new Error(`Missing Azure provider in state ${JSON.stringify(state)}`)
        }

        if (!state.provider?.azure?.provisionArgs) {
            throw new Error(`Missing Azure provision args in state ${JSON.stringify(state)}`)
        }

        const args = state.provider.azure.provisionArgs

        if (!state.ssh?.privateKeyPath) {
            throw new Error(`Provisioning Azure instance requires a private SSH key. Got state: ${JSON.stringify(state)}`)
        }

        if (!opts?.skipAuthCheck) {
            await AzureClient.checkAuth()
        }

        this.logger.debug(`Provisioning Azure instance with ${JSON.stringify(state)}`)

        if (args.create) {

            let confirmCreation: boolean
            if (opts?.autoApprove) {
                confirmCreation = opts.autoApprove
            } else {
                confirmCreation = await confirm({
                    message: `
    You are about to provision Azure machine with the following details:
        Azure subscription: ${args.create.subscriptionId}
        Azure location: ${args.create.location}
        Instance name: ${state.name}
        SSH key: ${state.ssh.privateKeyPath}
        VM Size: ${args.create.vmSize}
        Spot instance: ${args.create.useSpot}
        Public IP Type: ${args.create.publicIpType}
        Disk size: ${args.create.diskSize}
        
    Do you want to proceed?`,
                    default: true,
                })
            }

            if (!confirmCreation) {
                throw new Error('Azure provision aborted.')
            }

            await this.sm.update({
                status: {
                    initalized: true,
                },
                provider: {
                    azure: {}
                }
            })

            const pulumiClient = new AzurePulumiClient(state.name)
            const pulumiConfig: PulumiStackConfigAzure = {
                subscriptionId: args.create.subscriptionId,
                location: args.create.location,
                vmSize: args.create.vmSize,
                publicIpType: args.create.publicIpType,
                rootDiskSizeGB: args.create.diskSize,
                publicSshKeyContent: await parseSshPrivateKeyFileToPublic(state.ssh.privateKeyPath),
                useSpot: args.create.useSpot,
            }

            await pulumiClient.setConfig(pulumiConfig)
            const pulumiOutputs = await pulumiClient.up()

            await this.sm.update({
                host: pulumiOutputs.publicIp,
                provider: {
                    azure: {
                        vmName: pulumiOutputs.vmName,
                        resourceGroupName: pulumiOutputs.resourceGroupName
                    }
                }
            })
        } else {
            throw new Error(`Provisioning Azure requires creation of new instance, got ${JSON.stringify(args)}`)
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

    async destroy() {
        const state = this.sm.get()

        this.logger.info(`Destroying instance: ${this.sm.name()}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy Azure instance '${state.name}'. Please confirm:`,
            default: false,
        })

        if (!confirmCreation) {
            throw new Error('Destroy aborted.')
        }

        const pulumiClient = new AzurePulumiClient(state.name)
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
}
