export interface PaperspaceProviderStateV0 {
    machineId?: string,
    apiKey: string
    provisionArgs?: PaperspaceProvisionArgsV0
}

export interface PaperspaceProvisionArgsV0 {
    useExisting?: {
        machineId: string
        publicIp: string
    }
    apiKey?: string
    create?: {
        machineType: string
        diskSize: number
        publicIpType: 'static' | 'dynamic'
        region: string
    }
}

export interface PaperspaceProvisionStateV1 {
    machineId: string,
}

export interface PaperspaceProvisionConfigV1 {
    apiKey: string
    machineType: string
    diskSize: number
    publicIpType: 'static' | 'dynamic'
    region: string
}

