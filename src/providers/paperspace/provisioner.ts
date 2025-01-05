import { confirm } from '@inquirer/prompts';
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, InstanceProvisionOptions } from '../../core/provisioner';
import { PaperspaceClient } from './client/client';
import { MachinesCreateRequest } from './client/generated-api';
import { PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1 } from './state';

export type PaperspaceProvisionerArgs = InstanceProvisionerArgs<PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1>

export class PaperspaceProvisioner extends AbstractInstanceProvisioner<PaperspaceProvisionInputV1, PaperspaceProvisionOutputV1> {

    readonly client: PaperspaceClient

    constructor(args: PaperspaceProvisionerArgs) {
        super(args)
        this.client = new PaperspaceClient({ name: this.args.instanceName, apiKey: this.args.input.apiKey })
    }

    async doProvision(opts?: InstanceProvisionOptions) {

        const pspaceMachineName = this.args.instanceName
        
        const alreadyExists = await this.client.machineWithNameExists(pspaceMachineName)
        if(alreadyExists){
            this.logger.warn(`Machine ${this.args.instanceName} already provisioned. Paperspace doesn't support updating existing machine provisioning options.` +
            `You can either create another instance with desired options or update it manually.`)

            const existingMachine = await this.client.getMachineByName(this.args.instanceName)

            if (!existingMachine.publicIp) {
                throw new Error(`Existing machine does not have a public IP address. Got: ${JSON.stringify(existingMachine)}`)
            }

            return {
                host: existingMachine.publicIp,
                machineId: existingMachine.id
            }
        }

        let confirmCreation: boolean
        if(opts?.autoApprove !== undefined){
            confirmCreation = opts.autoApprove
        } else {
            confirmCreation = await confirm({
                message: `
You are about to provision Paperspace instance with the following details:
    Instance name: ${pspaceMachineName}
    SSH key: ${this.args.input.ssh.privateKeyPath}
    Region: ${this.args.input.region}
    Machine Type: ${this.args.input.machineType}
    Disk Size: ${this.args.input.diskSize} GB
    Public IP Type: ${this.args.input.publicIpType}
Do you want to proceed?`,
                default: true,
            })
        }

        if (!confirmCreation) {
            throw new Error('Machine creation aborted.');
        }

        const createArgs: MachinesCreateRequest = {
            name: pspaceMachineName,
            region: this.args.input.region,
            machineType: this.args.input.machineType,
            diskSize: this.args.input.diskSize,
            publicIpType: this.args.input.publicIpType,
            startOnCreate: true,

            // TODO Always create an Ubuntu 22.04 based on public template "t0nspur5"
            // All Ubuntu templates can be listed with 
            // $ pspace os-template list -j | jq '.items[] | select(.agentType == "LinuxHeadless" and (.operatingSystemLabel | tostring | contains("Ubuntu")))'
            templateId: "t0nspur5"
        }

        this.logger.debug(`Creating Paperspace machine: ${JSON.stringify(createArgs)}`)

        const createdMachine = await this.client.createMachine(createArgs);

        console.info(`Creating Paperspace machine ${createdMachine.id} named ${createdMachine.name}`)

        this.logger.debug(`Created new Paperspace machine with ID: ${createdMachine.id}`);

        if (!createdMachine.publicIp) {
            throw new Error(`Created machine does not have a public IP address. Got: ${JSON.stringify(createdMachine)}`)
        }

        return {
            host: createdMachine.publicIp,
            machineId: createdMachine.id
        }

    }

    async doDestroy(){
        if(this.args.output){
            const machineExists = await this.client.machineExists(this.args.output?.machineId)

            if(!machineExists){
                this.logger.warn(`Nothing to delete: machine ${this.args.output.machineId} not found. Was it already deleted ?`)
            } else {
                await this.client.deleteMachine(this.args.output.machineId, true)
            }
        } else {
            this.logger.warn(`Nothing to delete: no output for instance ${this.args.instanceName}. Was instance fully provisioned ?`)
        }

    }

    protected async doVerifyConfig(): Promise<void> {        
        const authResult = await this.client.checkAuth()
        this.logger.info(`Paperspace authenticated as ${authResult.user.email} (team: ${authResult.team.id})`)
    }


}