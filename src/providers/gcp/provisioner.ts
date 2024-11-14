import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner';
import { GcpPulumiClient, PulumiStackConfigGcp } from '../../tools/pulumi/gcp';
import { GcpClient } from '../../tools/gcp';
import { CommonProvisionStateV1 } from '../../core/state';
import { GcpProvisionStateV1 } from './state';

export interface GcpProvisionerArgs {
    instanceName: string
    common: CommonProvisionStateV1
    gcp: GcpProvisionStateV1
}

export class GcpProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {

    private readonly gcpArgs: GcpProvisionerArgs

    constructor(gcpArgs: GcpProvisionerArgs){
        super(gcpArgs)
        this.gcpArgs = gcpArgs
    }

    async provision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Google Cloud instance ${this.gcpArgs.instanceName}`)

        if(!opts?.skipAuthCheck){
            await this.checkGcpAuth(this.gcpArgs.gcp.config.projectId)
        }

        this.logger.debug(`Provisioning Google Cloud instance with ${JSON.stringify(this.gcpArgs.gcp.config)}`)

        
        let confirmCreation: boolean
        if(opts?.autoApprove){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Google Cloud machine with the following details:
    Instance name: ${this.gcpArgs.instanceName}
    SSH key: ${this.gcpArgs.common.config.ssh.privateKeyPath}
    Region: ${this.gcpArgs.gcp.config.region}
    Project ID: ${this.gcpArgs.gcp.config.projectId}
    Machine Type: ${this.gcpArgs.gcp.config.machineType}
    Use Spot: ${this.gcpArgs.gcp.config.useSpot}
    GPU Type: ${this.gcpArgs.gcp.config.acceleratorType}
    Public IP Type: ${this.gcpArgs.gcp.config.publicIpType}
    Disk size: ${this.gcpArgs.gcp.config.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Google Cloud provision aborted.');
        }

        const pulumiClient = new GcpPulumiClient(this.gcpArgs.instanceName)
        const pulumiConfig: PulumiStackConfigGcp = {
            machineType: this.gcpArgs.gcp.config.machineType,
            acceleratorType: this.gcpArgs.gcp.config.acceleratorType,
            projectId: this.gcpArgs.gcp.config.projectId,
            publicIpType: this.gcpArgs.gcp.config.publicIpType,
            region: this.gcpArgs.gcp.config.region,
            zone: this.gcpArgs.gcp.config.zone,
            rootDiskSize: this.gcpArgs.gcp.config.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.gcpArgs.common.config.ssh.privateKeyPath),
            useSpot: this.gcpArgs.gcp.config.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        this.gcpArgs.gcp.output = {
            instanceName: pulumiOutputs.instanceName
        }

        this.gcpArgs.common.output = {
            host: pulumiOutputs.publicIp
        }
    }

    async destroy(){

        this.logger.info(`Destroying instance: ${this.gcpArgs.instanceName}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy GCP instance '${this.gcpArgs.instanceName}'. Please confirm:`,
            default: false,
        });

        if (!confirmCreation) {
            throw new Error('Destroy aborted.');
        }

        const pulumiClient = new GcpPulumiClient(this.gcpArgs.instanceName)
        await pulumiClient.destroy()

        this.gcpArgs.gcp.output = undefined
        this.gcpArgs.common.output = undefined
    }

    private async checkGcpAuth(projectId: string) {
        const client = new GcpClient(this.gcpArgs.instanceName, projectId)
        await client.checkAuth()
    }
}
