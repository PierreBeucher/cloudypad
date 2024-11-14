import { confirm } from '@inquirer/prompts';
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner';
import { PaperspaceClient } from './client/client';
import { MachinesCreateRequest } from './client/generated-api';
import { PaperspaceProvisionStateV1 } from './state';
import { CommonProvisionStateV1 } from '../../core/state';

export interface PaperspaceProvisionerArgs {
    instanceName: string
    common: CommonProvisionStateV1
    pspace: PaperspaceProvisionStateV1
}

export class PaperspaceProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {
    
    private readonly pspaceArgs: PaperspaceProvisionerArgs

    constructor(pspaceArgs: PaperspaceProvisionerArgs){
        super(pspaceArgs)
        this.pspaceArgs = pspaceArgs
    }

    private async buildPaperspaceClient(){
        return new PaperspaceClient({ name: this.pspaceArgs.instanceName, apiKey: this.pspaceArgs.pspace.config.apiKey });
    }

    async provision(opts?: InstanceProvisionOptions) {

        const client = await this.buildPaperspaceClient()

        if(!opts?.skipAuthCheck){
            const authResult = await client.checkAuth()
            this.logger.info(`Paperspace authenticated as ${authResult.user.email} (team: ${authResult.team.id})`)
        }
        
        let confirmCreation: boolean
        if(opts?.autoApprove !== undefined){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Paperspace instance with the following details:
    Instance name: ${this.pspaceArgs.instanceName}
    SSH key: ${this.pspaceArgs.common.config.ssh.privateKeyPath}
    Region: ${this.pspaceArgs.pspace.config.region}
    Machine Type: ${this.pspaceArgs.pspace.config.machineType}
    Disk Size: ${this.pspaceArgs.pspace.config.diskSize} GB
    Public IP Type: ${this.pspaceArgs.pspace.config.publicIpType}
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Machine creation aborted.');
        }

        const createArgs: MachinesCreateRequest = {
            name: this.pspaceArgs.instanceName,
            region: this.pspaceArgs.pspace.config.region,
            machineType: this.pspaceArgs.pspace.config.machineType,
            diskSize: this.pspaceArgs.pspace.config.diskSize,
            publicIpType: this.pspaceArgs.pspace.config.publicIpType,
            startOnCreate: true,

            // TODO Always create an Ubuntu 22.04 based on public template "t0nspur5"
            // All Ubuntu templates can be listed with 
            // $ pspace os-template list -j | jq '.items[] | select(.agentType == "LinuxHeadless" and (.operatingSystemLabel | tostring | contains("Ubuntu")))'
            templateId: "t0nspur5"
        }

        this.logger.debug(`Creating Paperspace machine: ${JSON.stringify(createArgs)}`)

        const createdMachine = await client.createMachine(createArgs);

        console.info(`Creating Paperspace machine ${createdMachine.id} named ${createdMachine.name}`)

        this.logger.debug(`Created new Paperspace machine with ID: ${createdMachine.id}`);

        if (!createdMachine.publicIp) {
            throw new Error(`Created machine does not have a public IP address. Got: ${JSON.stringify(createdMachine)}`)
        }

    }

    async destroy(){

        this.logger.info(`Destroying Paperspace instance ${this.pspaceArgs.instanceName}`)

        const client = await this.buildPaperspaceClient()

        const confirmDeletion = await confirm({
            message: `You are about to destroy Paperspace instance ${this.pspaceArgs.instanceName} and any associated public IP (machine ID '${this.pspaceArgs.pspace.output?.machineId}'). Please confirm:`,
            default: false,
        })

        if (!confirmDeletion) {
            throw new Error('Destroy aborted.');
        }

        if(this.pspaceArgs.pspace.output){
            const machineExists = await client.machineExists(this.pspaceArgs.pspace.output?.machineId)

            if(!machineExists){
                this.logger.warn(`Nothing to delete: machine ${this.pspaceArgs.pspace.output.machineId} not found. Was it already deleted ?`)
            } else {
                await client.deleteMachine(this.pspaceArgs.pspace.output.machineId, true)
            }
        } else {
            this.logger.warn(`Nothing to delete: no output for instance ${this.pspaceArgs.instanceName}. Was instance fully provisioned ?`)
        }

    }


}