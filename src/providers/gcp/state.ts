import { CommonProvisionConfigV1, CommonProvisionOutputV1, InstanceStateV1 } from "../../core/state/state"

export type GcpInstanceStateV1 = InstanceStateV1 & {
    provision: {
        output?: GcpProvisionOutputV1,
        config: GcpProvisionConfigV1,
    }
}

export interface GcpProvisionOutputV1 extends CommonProvisionOutputV1 {
    instanceName: string,
}

export interface GcpProvisionConfigV1 extends CommonProvisionConfigV1 {
    projectId: string
    machineType: string
    acceleratorType: string
    diskSize: number
    publicIpType: string
    region: string
    zone: string
    useSpot: boolean
}

// V0

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