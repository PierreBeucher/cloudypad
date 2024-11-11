import { AzureProvisionArgsV0, AzureProvisionArgsV1 } from "./initializer";

export interface AzureProviderStateV0 {
    vmName?: string
    resourceGroupName?: string
    provisionArgs?: AzureProvisionArgsV0
}

export interface AzureProviderStateV1 {
    vmName: string
    resourceGroupName: string
    provisionArgs: AzureProvisionArgsV1
}