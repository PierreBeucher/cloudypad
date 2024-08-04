import { confirm } from '@inquirer/prompts';
import { BaseInstanceProvisioner, InstanceProvisioner, InstanceProvisionOptions } from '../../core/provisioner';
import { StateManager } from '../../core/state';
import { PaperspaceClient } from './client/client';
import { MachinesCreateRequest } from './client/generated-api';

export class PaperspaceProvisioner extends BaseInstanceProvisioner implements InstanceProvisioner {
    
    constructor(sm: StateManager){
        super(sm)
    }

    private async buildPaperspaceClient(){
        const state = this.sm.get()

        if(!state.provider?.paperspace?.apiKey) {
            throw new Error("Couldn't find Paperspace api key in state")
        }

        const client = new PaperspaceClient({ name: this.sm.name(), apiKey: state.provider.paperspace.apiKey });

        return client
    }

    async provision(opts: InstanceProvisionOptions) {

        const state = this.sm.get()

        if(!state.provider?.paperspace){
            throw new Error(`Missing paperspace provider in state: ${state}`)
        }

        if(!state.provider.paperspace.provisionArgs){
            throw new Error(`Missing provision args in state: ${state}`)
        }

        if(state.provider.paperspace.machineId){
            this.logger.info(`Paperspaced machine ${state.provider.paperspace.machineId} already provisioned for ${state.name}. Nothing to do.`)
            return 
        }

        const client = await this.buildPaperspaceClient()

        if(!opts.skipAuthCheck){
            const authResult = await client.authSession()
            this.logger.info(`Paperspace authenticated as ${authResult.user.email} (team: ${authResult.team.id})`)
        }
        
        const args = state.provider.paperspace.provisionArgs
    
        if (args.useExisting) {
            
            this.sm.update({
                status: {
                    initalized: true
                },
                host: args.useExisting.publicIp, 
                provider: {
                    paperspace: {
                        machineId: args.useExisting.machineId
                    }
                }
            })
            
        } else if (args.create) {
           
            const state = this.sm.get()

            let confirmCreation: boolean
            if(opts.autoApprove !== undefined){
                confirmCreation = opts.autoApprove
            } else {
                confirmCreation = await confirm({
                    message: `
    You are about to provision Paperspace instance with the following details:
        Instance name: ${state.name}
        SSH key: ${state.ssh?.privateKeyPath}
        Region: ${args.create.region}
        Machine Type: ${args.create.machineType}
        Disk Size: ${args.create.diskSize} GB
        Public IP Type: ${args.create.publicIpType}
    Do you want to proceed?`,
                    default: true,
                })
            }

            if (!confirmCreation) {
                throw new Error('Machine creation aborted.');
            }

            this.sm.update({
                status: {
                    initalized: true
                },
                provider: {
                    paperspace: {
                        provisionArgs: args
                    }
                }
            })

            const createArgs: MachinesCreateRequest = {
                name: state.name,
                region: args.create.region,
                machineType: args.create.machineType,
                diskSize: args.create.diskSize,
                publicIpType: args.create.publicIpType,
                startOnCreate: true,

                // TODO Always create an Ubuntu 22.04 based on public template "t0nspur5"
                // All Ubuntu templates can be listed with 
                // $ pspace os-template list -j | jq '.items[] | select(.agentType == "LinuxHeadless" and (.operatingSystemLabel | tostring | contains("Ubuntu")))'
                templateId: "t0nspur5"
            }

            this.logger.debug(`Creating Paperspace machine: ${JSON.stringify(createArgs)}`)

            const createdMachine = await client.createMachine(createArgs);

            console.info(`Creating Paperspace machine ${createdMachine.id} named ${createdMachine.name}`)

            this.sm.update({
                provider: {
                    paperspace: {
                        machineId: createdMachine.id
                    }
                },
                status: {
                    provision: {
                        provisioned: true,
                        lastUpdate: Date.now()
                    }
                }
            })

            this.logger.debug(`Created new Paperspace machine with ID: ${createdMachine.id}`);

            if (!createdMachine.publicIp) {
                throw new Error(`Created machine does not have a public IP address. Got: ${JSON.stringify(createdMachine)}`)
            }

            this.sm.update({
                host: createdMachine.publicIp,
            })
        } else {
            throw new Error(`Provisioning Paperspace requires at least create or useExisting, got ${args}`)
        }

    }

    async destroy(){
        const state = this.sm.get()

        this.logger.info(`Destroying Paperspace instance ${this.sm.name()}`)

        if(!state.provider?.paperspace){
            throw new Error(`Missing paperspace provider in state: ${state}`)
        }

        if(!state.provider.paperspace.machineId){
            throw new Error(`Missing machine id in state: ${state}`)
        }

        const client = await this.buildPaperspaceClient()

        const confirmDeletion = await confirm({
            message: `You are about to destroy Paperspace instance ${state.name} and any associated public IP (machine ${state.provider?.paperspace?.machineId}). Please confirm:`,
            default: false,
        })

        if (!confirmDeletion) {
            throw new Error('Destroy aborted.');
        }

        const machineExists = await client.machineExists(state.provider.paperspace.machineId)

        if(!machineExists){
            this.logger.warn(`Machine ${state.provider.paperspace.machineId} not found. Was it already deleted ?`)
        } else {
            await client.deleteMachine(state.provider.paperspace.machineId, true)
        }

        this.sm.update({
            provider: {
                paperspace: {
                    machineId: undefined
                }
            },
            status: {
                provision: {
                    provisioned: false,
                    lastUpdate: Date.now()
                }
            }
        })

    }


}