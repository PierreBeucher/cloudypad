import { GcpProvisionArgs } from "./initializer";

export interface GcpProviderState {
    instanceName?: string,
    provisionArgs?: GcpProvisionArgs
}