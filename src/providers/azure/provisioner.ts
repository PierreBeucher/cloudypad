import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh'
import { confirm } from '@inquirer/prompts'
import { AzurePulumiClient, PulumiStackConfigAzure } from '../../tools/pulumi/azure'
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionStateV1 } from './state'
import { CommonProvisionStateV1 } from '../../core/state'

export interface AzureProvisionerArgs {
    instanceName: string
    az: AzureProvisionStateV1
    common: CommonProvisionStateV1
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
    Azure subscription: ${this.args.az.config.subscriptionId}
    Azure location: ${this.args.az.config.location}
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.common.config.ssh.privateKeyPath}
    VM Size: ${this.args.az.config.vmSize}
    Spot instance: ${this.args.az.config.useSpot}
    Public IP Type: ${this.args.az.config.publicIpType}
    Disk size: ${this.args.az.config.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Azure provision aborted.')
        }

        const pulumiClient = new AzurePulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigAzure = {
            subscriptionId: this.args.az.config.subscriptionId,
            location: this.args.az.config.location,
            vmSize: this.args.az.config.vmSize,
            publicIpType: this.args.az.config.publicIpType,
            rootDiskSizeGB: this.args.az.config.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.common.config.ssh.privateKeyPath),
            useSpot: this.args.az.config.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        this.args.common.output = {
            host: pulumiOutputs.publicIp
        }

        this.args.az.output = {
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

        this.args.common.output = undefined
        this.args.az.output = undefined
    }
}
