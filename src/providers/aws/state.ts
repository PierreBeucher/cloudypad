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

export interface AwsProviderV1 {
    state?: AwsProviderStateV1
    config: AwsProviderConfigV1
}

export interface AwsProviderStateV1 {
    instanceId: string
}

export interface AwsProviderConfigV1 {
    instanceType: string
    diskSize: number
    publicIpType: string
    region: string
    useSpot: boolean
}