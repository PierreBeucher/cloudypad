import { PaperspaceProvisionArgs } from "./initializer"

export interface PaperspaceProviderState {
    machineId?: string,
    apiKey: string
    provisionArgs?: PaperspaceProvisionArgs
}