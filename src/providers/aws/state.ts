export interface AwsProvisionArgsV0 {
    create: {
        instanceType: string
        diskSize: number
        publicIpType: string
        region: string
        useSpot: boolean
    }
}

export interface AwsProviderStateV0 {
    instanceId?: string,
    provisionArgs?: AwsProvisionArgsV0
}

export interface AwsProvisionStateV1 {
    output?: AwsProvisionOutputV1,
    config: AwsProvisionConfigV1
}

export interface AwsProvisionOutputV1 {
    instanceId: string
}

export interface AwsProvisionConfigV1 {
    instanceType: string
    diskSize: number
    publicIpType: string
    region: string
    useSpot: boolean
}