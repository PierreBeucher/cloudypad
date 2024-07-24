import { PaperspaceProvisionArgs } from "./provisioner"

export interface PaperspaceProviderState {
    machineId?: string,
    apiKey: string
    provisionArgs?: PaperspaceProvisionArgs
}