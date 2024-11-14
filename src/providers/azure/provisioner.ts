import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from '../../tools/pulumi/azure'
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionStateV1 } from './state'
import { CommonProvisionStateV1 } from '../../core/state'

export interface AzureProvisionerArgs {
    instanceName: string
    azState: AzureProvisionStateV1
    commonState: CommonProvisionStateV1
}

export class AzureProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    readonly args: AzureProvisionerArgs

    constructor(args: AzureProvisionerArgs) {
        super({ instanceName: args.instanceName})
        this.args = args
    }

    async provision(opts?: InstanceProvisionOptions) {

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
    Azure subscription: ${this.args.azState.config.subscriptionId}
    Azure location: ${this.args.azState.config.location}
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.commonState.config.ssh.privateKeyPath}
    VM Size: ${this.args.azState.config.vmSize}
    Spot instance: ${this.args.azState.config.useSpot}
    Public IP Type: ${this.args.azState.config.publicIpType}
    Disk size: ${this.args.azState.config.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Azure provision aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.azState.config.subscriptionId,
            location: this.args.azState.config.location,
            vmSize: this.args.azState.config.vmSize,
            publicIpType: this.args.azState.config.publicIpType,
            rootDiskSizeGB: this.args.azState.config.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.commonState.config.ssh.privateKeyPath),
            useSpot: this.args.azState.config.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        this.args.commonState.output = {
            host: pulumiOutputs.publicIp
        }

        this.args.azState.output = {
            resourceGroupName: pulumiOutputs.resourceGroupName,
            vmName: pulumiOutputs.vmName,
        }
    }

    async destroy() {

        this.logger.info(`Destroying instance: ${this.args.instanceName}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy Azure instance '${this.args.instanceName}'. Please confirm:`,
            default: false,
        })

        if (!confirmCreation) {
            throw new Error('Destroy aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.commonState.output = undefined
        this.args.azState.output = undefined
    }
}
