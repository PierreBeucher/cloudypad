import { PaperspaceInstanceStateV1 } from '../../providers/paperspace/state'
import { AwsInstanceStateV1 } from '../../providers/aws/state'
import { getLogger } from '../../log/utils'
import { CLOUDYPAD_PROVIDER, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from '../const'
import { AzureInstanceStateV1 } from '../../providers/azure/state'
import { GcpInstanceStateV1 } from '../../providers/gcp/state'
import { InstanceStateV0 } from './state'
import { AnyInstanceStateV1 } from './parser'

export class StateMigrator {

    private logger = getLogger(StateMigrator.name)

    /**
     * Ensure a raw state loaded from disk matches the current V1 State interface
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async migrateStateV0toV1(rawState: any): Promise<AnyInstanceStateV1>{

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
                        config: {
                            ...providerV0.aws.provisionArgs.create,
                            publicIpType: providerV0.aws.provisionArgs.create.publicIpType,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        }
                    },

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
                        config: {
                            ...providerV0.azure.provisionArgs.create,
                            publicIpType: providerV0.azure.provisionArgs.create.publicIpType,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        }
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
                        config: {
                            ...providerV0.gcp.provisionArgs.create,
                            publicIpType: providerV0.gcp.provisionArgs.create.publicIpType,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        }
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
                        config: {
                            ...providerV0.paperspace.provisionArgs.create,
                            apiKey: providerV0.paperspace.apiKey ?? providerV0.paperspace.provisionArgs.apiKey,
                            ssh: {
                                user: stateV0.ssh.user,
                                privateKeyPath: stateV0.ssh.privateKeyPath
                            },
                        }
                    },
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
