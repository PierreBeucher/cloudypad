import * as path from 'path'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { PaperspaceInstanceStateV1 } from '../../providers/paperspace/state'
import { AwsInstanceStateV1 } from '../../providers/aws/state'
import { getLogger } from '../../log/utils'
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from '../const'
import { AZURE_SUPPORTED_DISK_TYPES, AzureInstanceStateV1 } from '../../providers/azure/state'
import { GcpInstanceStateV1 } from '../../providers/gcp/state'
import { InstanceStateV0 } from './state'
import { AnyInstanceStateV1 } from './parser'
import { BaseStateManager } from './base-manager'
import { StateWriter } from './writer'

export class StateMigrator extends BaseStateManager {

    private logger = getLogger(StateMigrator.name)

    /**
     * 
     * @param instanceName 
     */
    async needMigration(instanceName: string): Promise<boolean>{

        const v0InstancePath = this.getInstanceStateV0Path(instanceName)

        this.logger.debug(`Checking if instance ${instanceName} needs migration using ${v0InstancePath}`)

        if(fs.existsSync(this.getInstanceDir(instanceName)) && fs.existsSync(v0InstancePath)) {
            return true
        }

        return false
    }

    async ensureInstanceStateV1(instanceName: string){
        const needsMigration = await this.needMigration(instanceName)
        if(!needsMigration){
            return
        }

        const v0StatePath = this.getInstanceStateV0Path(instanceName)
        this.logger.debug(`Migrating instance ${instanceName} state V0 to V1 state using V0 state ${v0StatePath}`)
        
        this.logger.debug(`Loading instance V0 state for ${instanceName} at ${v0StatePath}`)

        const rawState = yaml.load(fs.readFileSync(v0StatePath, 'utf8'))

        this.logger.debug(`Loaded state of ${instanceName} for migration: ${v0StatePath}`)

        // Migrate state and persist
        this.logger.debug(`Migrating instance V0 state to V1 for ${instanceName} at ${v0StatePath}`)
        const result = await this.doMigrateStateV0toV1(rawState)
        const writer = new StateWriter({ state: result, dataRootDir: this.dataRootDir })
        await writer.persistStateNow()

        // Delete old state file
        this.logger.debug(`Deleting old V0 state for ${instanceName} at ${v0StatePath}`)
        fs.rmSync(v0StatePath)
    }

    private getInstanceStateV0Path(instanceName: string): string {
        return path.join(this.getInstanceDir(instanceName), "config.yml")
    }

    /**
     * Ensure a raw state loaded from disk matches the current V1 State interface
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async doMigrateStateV0toV1(rawState: any): Promise<AnyInstanceStateV1>{

        const stateV0 = rawState as InstanceStateV0

        const name = stateV0.name

        // Transform provider
        const providerV0 = stateV0.provider
        let stateV1: AnyInstanceStateV1

        let providerName: CLOUDYPAD_PROVIDER

        try {
            if(!stateV0.ssh || !stateV0.ssh.user || !stateV0.ssh.privateKeyPath) {
                throw new Error("Missing SSH config in state. Was instance fully configured ?")
            }

            if(providerV0?.aws) {
                providerName = CLOUDYPAD_PROVIDER_AWS
                if(!providerV0.aws.provisionArgs || !providerV0.aws.provisionArgs.create){
                    throw new Error("Missing AWS provision args in state. Was instance fully configured ?")
                }

                if(providerV0.aws.provisionArgs.create.publicIpType !== PUBLIC_IP_TYPE_STATIC &&
                    providerV0.aws.provisionArgs.create.publicIpType !== PUBLIC_IP_TYPE_DYNAMIC) {
                    throw new Error(`Public IP type is neither ${PUBLIC_IP_TYPE_STATIC} nor ${PUBLIC_IP_TYPE_DYNAMIC}`)
                }

                const awsState: AwsInstanceStateV1 = {
                    name: name,
                    version: "1",
                    provision: {
                        provider: providerName,
                        input: {
                            ...providerV0.aws.provisionArgs.create,
                            publicIpType: providerV0.aws.provisionArgs.create.publicIpType,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        }
                    },
                    configuration: {
                        configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                        input: {}
                    }
                }

                if(stateV0.host){
                    if(!providerV0.aws.instanceId){
                        throw new Error(`Invalid state: host is defined but not AWS instance ID.`)
                    }

                    awsState.provision.output = {
                        host: stateV0.host,
                        instanceId: providerV0.aws.instanceId,
                    }
                }

                stateV1 = awsState

            } else if (providerV0?.azure) {

                providerName = CLOUDYPAD_PROVIDER_AZURE

                if(!providerV0.azure.provisionArgs || !providerV0.azure.provisionArgs.create){
                    throw new Error("Missing Azure provision args in state. Was instance fully configured ?")
                }

                if(providerV0.azure.provisionArgs.create.publicIpType !== PUBLIC_IP_TYPE_STATIC &&
                    providerV0.azure.provisionArgs.create.publicIpType !== PUBLIC_IP_TYPE_DYNAMIC) {
                    throw new Error(`Public IP type is neither ${PUBLIC_IP_TYPE_STATIC} nor ${PUBLIC_IP_TYPE_DYNAMIC}`)
                }

                const azureState: AzureInstanceStateV1 = {
                    name: name,
                    version: "1",
                    provision: {
                        provider: providerName,
                        input: {
                            ...providerV0.azure.provisionArgs.create,
                            publicIpType: providerV0.azure.provisionArgs.create.publicIpType,
                            diskType: AZURE_SUPPORTED_DISK_TYPES.STANDARD_LRS,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        },
                    },
                    configuration: {
                        configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                        input: {}
                    },

                }

                if(stateV0.host){
                    if(!providerV0.azure.vmName || !providerV0.azure.resourceGroupName){
                        throw new Error(`Invalid state: host is defined but Azure VM name and/or Resource Group is missing.`)
                    }
                    
                    azureState.provision.output = {
                        host: stateV0.host,
                        resourceGroupName: providerV0.azure.resourceGroupName,
                        vmName: providerV0.azure.vmName
                    }
                }

                stateV1 = azureState

            } else if (providerV0?.gcp) {

                providerName = CLOUDYPAD_PROVIDER_GCP

                if(!providerV0.gcp.provisionArgs || !providerV0.gcp.provisionArgs.create){
                    throw new Error("Missing Google provision args in state. Was instance fully provisioned ?")
                }

                if(providerV0.gcp.provisionArgs.create.publicIpType !== PUBLIC_IP_TYPE_STATIC &&
                    providerV0.gcp.provisionArgs.create.publicIpType !== PUBLIC_IP_TYPE_DYNAMIC) {
                    throw new Error(`Public IP type is neither ${PUBLIC_IP_TYPE_STATIC} nor ${PUBLIC_IP_TYPE_DYNAMIC}`)
                }

                const gcpState: GcpInstanceStateV1 = {
                    name: name,
                    version: "1",
                    provision: {
                        provider: providerName,
                        input: {
                            ...providerV0.gcp.provisionArgs.create,
                            publicIpType: providerV0.gcp.provisionArgs.create.publicIpType,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        },
                    },
                    configuration: {
                        configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                        input: {}
                    },
                }

                if(stateV0.host){
                    if(!providerV0.gcp.instanceName){
                        throw new Error(`Invalid state: host is defined but GCP instance name is missing.`)
                    }
                    
                    gcpState.provision.output = {
                        host: stateV0.host,
                        instanceName: providerV0.gcp.instanceName
                    }
                }

                stateV1 = gcpState

            } else if (providerV0?.paperspace) {

                providerName = CLOUDYPAD_PROVIDER_PAPERSPACE

                if(!providerV0.paperspace.provisionArgs || !providerV0.paperspace.provisionArgs.create){
                    throw new Error("Missing Paperspace provision args in state. Was instance fully configured ?")
                }

                if(!providerV0.paperspace.apiKey && !providerV0.paperspace.provisionArgs.apiKey){
                    throw new Error("Missing Paperspace API Key. Was instance fully configured ?")
                }

                const pspaceState: PaperspaceInstanceStateV1 = {
                    name: name,
                    version: "1",
                    provision: {
                        provider: providerName,
                        input: {
                            ...providerV0.paperspace.provisionArgs.create,
                            apiKey: providerV0.paperspace.apiKey ?? providerV0.paperspace.provisionArgs.apiKey,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        },
                    },
                    configuration: {
                        configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                        input: {}
                    }
                }

                if(stateV0.host){
                    if(!providerV0.paperspace.machineId){
                        throw new Error(`Invalid state: host is defined but Paperspace machine ID and/or API Key is missing.`)
                    }
                    
                    pspaceState.provision.output = {
                        host: stateV0.host,
                        machineId: providerV0.paperspace.machineId
                    }
                }

                stateV1 = pspaceState

            } else {
                throw new Error(`Unknwon provider in state ${JSON.stringify(providerV0)}`)
            }
        } catch (e) {
            this.logger.error(e)
            throw new Error(`Unable to migrate State from V0 to V1. Please create an issue with full error log and state: ${JSON.stringify(rawState)}`)
        }
        return stateV1

    }
}
