import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from '../../tools/pulumi/azure'
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionConfigV1, AzureProvisionStateV1 } from './state'
import { CommonProvisionConfigV1 } from '../../core/state'

export interface AzureProvisionerArgs {
    instanceName: string,
    azConfig: AzureProvisionConfigV1
    commonConfig: CommonProvisionConfigV1
}

export class AzureProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner<AzureProvisionStateV1> {

    readonly args: AzureProvisionerArgs

    constructor(args: AzureProvisionerArgs) {
        super({ instanceName: args.instanceName})
        this.args = args
    }

    async provision(opts?: InstanceProvisionOptions): Promise<AzureProvisionStateV1> {

        this.logger.info(`Provisioning Azure instance ${this.args.instanceName}`)

        if (!opts?.skipAuthCheck) {
            await AzureClient.checkAuth()
        }

        this.logger.debug(`Provisioning Azure instance ${JSON.stringify(this.args)}`)

        let confirmCreation: boolean
        if (opts?.autoApprove) {
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Azure machine with the following details:
    Azure subscription: ${this.args.azConfig.subscriptionId}
    Azure location: ${this.args.azConfig.location}
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.commonConfig.ssh.privateKeyPath}
    VM Size: ${this.args.azConfig.vmSize}
    Spot instance: ${this.args.azConfig.useSpot}
    Public IP Type: ${this.args.azConfig.publicIpType}
    Disk size: ${this.args.azConfig.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Azure provision aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.azConfig.subscriptionId,
            location: this.args.azConfig.location,
            vmSize: this.args.azConfig.vmSize,
            publicIpType: this.args.azConfig.publicIpType,
            rootDiskSizeGB: this.args.azConfig.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.commonConfig.ssh.privateKeyPath),
            useSpot: this.args.azConfig.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            resourceGroupName: pulumiOutputs.resourceGroupName,
            vmName: pulumiOutputs.vmName
        }

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
