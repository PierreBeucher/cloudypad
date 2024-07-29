import { AwsInitializationArgs } from "./initializer";

export interface AwsProviderState {
    instanceId?: string,
    provisionArgs?: AwsInitializationArgs
}