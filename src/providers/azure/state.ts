import { AzureProvisionArgs } from "./initializer";

export interface AzureProviderState {
    vmName?: string
    resourceGroupName?: string
    provisionArgs?: AzureProvisionArgs
}