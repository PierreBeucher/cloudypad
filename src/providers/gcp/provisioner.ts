import { parseSshPrivateKeyFileToPublic } from '../../tools/ssh';
import { confirm } from '@inquirer/prompts';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner';
import { GcpPulumiClient, PulumiStackConfigGcp } from '../../tools/pulumi/gcp';
import { GcpClient } from '../../tools/gcp';
import { GcpProvisionInputV1, GcpProvisionOutputV1} from './state';

export type GcpProvisionerArgs = InstanceProvisionerArgs<GcpProvisionInputV1, GcpProvisionOutputV1>

export class GcpProvisioner extends AbstractInstanceProvisioner<GcpProvisionInputV1, GcpProvisionOutputV1> {

    constructor(args: GcpProvisionerArgs) {
        super(args)
    }

    async doProvision(opts?: InstanceProvisionOptions) {

        this.logger.info(`Provisioning Google Cloud instance ${this.args.instanceName}`)

        if(!opts?.skipAuthCheck){
            await this.verifyConfig()
        }

        this.logger.debug(`Provisioning Google Cloud instance with ${JSON.stringify(this.args.input)}`)

        
        let confirmCreation: boolean
        if(opts?.autoApprove){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Google Cloud machine with the following details:
    Instance name: ${this.args.instanceName}
    SSH key: ${this.args.input.ssh.privateKeyPath}
    Region: ${this.args.input.region}
    Project ID: ${this.args.input.projectId}
    Machine Type: ${this.args.input.machineType}
    Use Spot: ${this.args.input.useSpot}
    GPU Type: ${this.args.input.acceleratorType}
    Public IP Type: ${this.args.input.publicIpType}
    Disk size: ${this.args.input.diskSize}
    
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Google Cloud provision aborted.');
        }

        const pulumiClient = new GcpPulumiClient(this.args.instanceName)
        const pulumiConfig: PulumiStackConfigGcp = {
            machineType: this.args.input.machineType,
            acceleratorType: this.args.input.acceleratorType,
            projectId: this.args.input.projectId,
            publicIpType: this.args.input.publicIpType,
            region: this.args.input.region,
            zone: this.args.input.zone,
            rootDiskSize: this.args.input.diskSize,
            publicSshKeyContent: await parseSshPrivateKeyFileToPublic(this.args.input.ssh.privateKeyPath),
            useSpot: this.args.input.useSpot,
        }

        await pulumiClient.setConfig(pulumiConfig)
        const pulumiOutputs = await pulumiClient.up()

        return {
            instanceName: pulumiOutputs.instanceName,
            host: pulumiOutputs.publicIp
        }

    }

    async doDestroy(){

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

    async doVerifyConfig() {
        const client = new GcpClient(this.args.instanceName, this.args.input.projectId)
        await client.checkAuth()
    }
}
