import { CommonProvisionConfigV1, CommonProvisionOutputV1, InstanceStateV1 } from "../../core/state"

export type AwsInstanceStateV1 = InstanceStateV1<AwsProvisionConfigV1, AwsProvisionOutputV1>

export interface AwsProvisionOutputV1 extends CommonProvisionOutputV1 {
    instanceId: string
}

export interface AwsProvisionConfigV1 extends CommonProvisionConfigV1 {
    instanceType: string
    diskSize: number
    publicIpType: string
    region: string
    useSpot: boolean
}

// V0

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