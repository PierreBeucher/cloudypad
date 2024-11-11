import { PaperspaceProvisionArgsV0, PaperspaceProvisionArgsV1 } from "./initializer"

export interface PaperspaceProviderStateV0 {
    machineId?: string,
    apiKey: string
    provisionArgs?: PaperspaceProvisionArgsV0
}

export interface PaperspaceProviderStateV1 {
    machineId: string,
    apiKey: string
    provisionArgs: PaperspaceProvisionArgsV1
}