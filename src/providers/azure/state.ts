import { CommonProvisionConfigV1, CommonProvisionOutputV1, InstanceStateV1 } from "../../core/state"

export type AzureInstanceStateV1 = InstanceStateV1<AzureProvisionConfigV1, AzureProvisionOutputV1>

export interface AzureProvisionOutputV1 extends CommonProvisionOutputV1 {
    vmName: string
    resourceGroupName: string
}

export interface AzureProvisionConfigV1 extends CommonProvisionConfigV1 {
    vmSize: string
    diskSize: number
    publicIpType: string
    subscriptionId: string
    location: string
    useSpot: boolean
}

// V0

export interface AzureProviderStateV0 {
    vmName?: string
    resourceGroupName?: string
    provisionArgs?: AzureProvisionArgsV0
}

export interface AzureProvisionArgsV0 {
    create: {
        vmSize: string
        diskSize: number
        publicIpType: string
        subscriptionId: string
        location: string
        useSpot: boolean
    }
}

