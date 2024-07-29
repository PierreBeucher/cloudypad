import { AwsProvisionArgs } from "./initializer";

export interface AwsProviderState {
    instanceId?: string,
    provisionArgs?: AwsProvisionArgs
}