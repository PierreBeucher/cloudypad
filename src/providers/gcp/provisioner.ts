import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { BaseInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner';
import { GcpPulumiClient, PulumiStackConfigGcp } from '../../tools/pulumi/gcp';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionConfigV1, GcpProvisionOutputV1} from './state';

export type GcpProvisionerArgs = InstanceProvisionerArgs<GcpProvisionConfigV1, GcpProvisionOutputV1>

export class GcpProvisioner extends BaseInstanceProvisioner<GcpProvisionConfigV1, GcpProvisionOutputV1> {

    constructor(args: GcpProvisionerArgs) {
        super(args)
    }

    async provision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Google Cloud instance ${this.args.instanceName}`)

        if(!opts?.skipAuthCheck){
            await this.checkGcpAuth(this.args.config.projectId)
        }

        this.logger.debug(`Provisioning Google Cloud instance with ${JSON.stringify(this.args.config)}`)

        
        let confirmCreation: boolean
        if(opts?.autoApprove){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Google Cloud machine with the following details:
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.config.ssh.privateKeyPath}
    Region: ${this.args.config.region}
    Project ID: ${this.args.config.projectId}
    Machine Type: ${this.args.config.machineType}
    Use Spot: ${this.args.config.useSpot}
    GPU Type: ${this.args.config.acceleratorType}
    Public IP Type: ${this.args.config.publicIpType}
    Disk size: ${this.args.config.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Google Cloud provision aborted.');
        }

        const pulumiClient = new GcpPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigGcp = {
            machineType: this.args.config.machineType,
            acceleratorType: this.args.config.acceleratorType,
            projectId: this.args.config.projectId,
            publicIpType: this.args.config.publicIpType,
            region: this.args.config.region,
            zone: this.args.config.zone,
            rootDiskSize: this.args.config.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.config.ssh.privateKeyPath),
            useSpot: this.args.config.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            instanceName: pulumiOutputs.instanceName,
            host: pulumiOutputs.publicIp
        }

    }

    async destroy(){

        this.logger.info(`Destroying instance: ${this.args.instanceName}`)

        const confirmCreation = await confirm({
            message: `You are about to destroy GCP instance '${this.args.instanceName}'. Please confirm:`,
            default: false,
        });

        if (!confirmCreation) {
            throw new Error('Destroy aborted.');
        }

        const pulumiClient = new GcpPulumiClient(this.args.instanceName)
        await pulumiClient.destroy()

        this.args.output = undefined
    }

    private async checkGcpAuth(projectId: string) {
        const client = new GcpClient(this.args.instanceName, projectId)
        await client.checkAuth()
    }
}
