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

export interface AzureProvisionStateV1 {
    config: AzureProvisionConfigV1
    output?: AzureProvisionOutputV1
}

export interface AzureProvisionOutputV1 {
    vmName: string
    resourceGroupName: string
}

export interface AzureProvisionConfigV1 {
    vmSize: string
    diskSize: number
    publicIpType: string
    subscriptionId: string
    location: string
    useSpot: boolean
}