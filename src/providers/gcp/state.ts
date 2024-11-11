import { GcpProvisionArgsV0, GcpProvisionArgsV1 } from "./initializer";

export interface GcpProviderStateV0 {
    instanceName?: string,
    provisionArgs?: GcpProvisionArgsV0
}

export interface GcpProviderStateV1 {
    instanceName: string,
    provisionArgs: GcpProvisionArgsV1
}