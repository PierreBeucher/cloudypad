import { AWSProvisionArgs } from "./provisioner";

export interface AwsProviderState {
    instanceId?: string,
    provisionArgs?: AWSProvisionArgs
}