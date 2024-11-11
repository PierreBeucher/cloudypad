export interface GcpProviderStateV0 {
    instanceName?: string,
    provisionArgs?: GcpProvisionArgsV0
}

export interface GcpProvisionArgsV0 {
    create: {
        projectId: string
        machineType: string
        acceleratorType: string
        diskSize: number
        publicIpType: string
        region: string
        zone: string
        useSpot: boolean
    }
}

export interface GcpProvisionStateV1 {
    instanceName: string,
}

export interface GcpProvisionConfigV1 {
    projectId: string
    machineType: string
    acceleratorType: string
    diskSize: number
    publicIpType: string
    region: string
    zone: string
    useSpot: boolean
}