import { select, confirm } from '@inquirer/prompts';
import { InstanceProvisioner } from '../../core/provisioner';
import { InstanceState, StateManager } from '../../core/state';
import { PaperspaceClient } from './client/client';
import { MachinesCreateRequest } from './client/generated-api';

export interface PaperspaceProvisionArgs {
    apiKey: string,
    useExisting?: {
        machineId: string
        publicIp: string
    }
    create?: {
        machineType: string
        diskSize: number
        publicIpType: 'static' | 'dynamic'
        region: string
    }
}

export class PaperspaceProvisioner implements InstanceProvisioner {
    
    readonly sm: StateManager

    constructor(sm: StateManager){
        this.sm = sm
    }

    private async buildPaperspaceClient(){
        const state = this.sm.get()

        if(!state.provider?.paperspace?.apiKey) {
            throw new Error("Couldn't find Paperspace api key in state")
        }

        const client = new PaperspaceClient({ apiKey: state.provider.paperspace.apiKey });

        const authResult = await client.authSession()
        console.debug(`Paperspace authenticated as ${authResult.user.email} (team: ${authResult.team.id})`)

        return client
    }

    async provision() {

        const state = this.sm.get()

        if(!state.provider?.paperspace){
            throw new Error(`Missing paperspace provider in state: ${state}`)
        }

        if(!state.provider.paperspace.provisionArgs){
            throw new Error(`Missing provision args in state: ${state}`)
        }

        const client = await this.buildPaperspaceClient()

        const args = state.provider.paperspace.provisionArgs
    
        if (args.useExisting) {
            
            this.sm.update({
                status: {
                    initalized: true
                },
                host: args.useExisting.publicIp, 
                provider: {
                    paperspace: {
                        apiKey: args.apiKey,
                        machineId: args.useExisting.machineId
                    }
                }
            })
            
        } else if (args.create) {
           
            const state = this.sm.get()
            const confirmCreation = await confirm({
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
            });

            if (!confirmCreation) {
                throw new Error('Machine creation aborted.');
            }

            this.sm.update({
                status: {
                    initalized: true
                },
                provider: {
                    paperspace: {
                        apiKey: args.apiKey,
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

            console.debug(`Creating Paperspace machine: ${JSON.stringify(createArgs)}`)

            const createdMachine = await client.createMachine(createArgs);

            this.sm.update({
                provider: {
                    paperspace: {
                        machineId: createdMachine.id
                    }
                }
            })

            console.debug(`Created new Paperspace machine with ID: ${createdMachine.id}`);

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

        if(!state.provider?.paperspace){
            throw new Error(`Missing paperspace provider in state: ${state}`)
        }

        if(!state.provider.paperspace.machineId){
            throw new Error(`Missing machine id in state: ${state}`)
        }

        const client = await this.buildPaperspaceClient()

        const confirmCreation = await confirm({
            message: `You are about to destroy Paperspace instance ${state.name} (machine ${state.provider?.paperspace?.machineId}). Please confirm:`,
            default: false,
        })

        if (!confirmCreation) {
            throw new Error('Destroy aborted.');
        }

        client.deleteMachine(state.provider.paperspace.machineId)

    }


}