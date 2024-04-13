import { RawAxiosRequestConfig } from 'axios'
import * as paperspace from './generated-api/api.js'
import lodash from 'lodash';
const { merge } = lodash;

/**
 * Wrap a client error from Axios potential error
 */
export interface PaperspaceClientError {
    message?: any
    status?: number
    source?: any
}

/**
 * Client wrapping generated Paperspace API code
 * See Taskfile.yml paperspace-client-gen to update underlying code 
 */
export class PaperspaceClient {

    private apiKey: string
    private baseOptions: RawAxiosRequestConfig
    private client: paperspace.MachineApi

    constructor(apiKey: string) {
        this.apiKey = apiKey
        this.baseOptions = { headers: { 
            Authorization: `Bearer ${this.apiKey}`,
        }}
        this.client = new paperspace.MachineApi()
    }

    async getMachine(machineId: string): Promise<paperspace.MachinesList200ResponseItemsInner> {
        try {
            const resp = await this.client.machinesGet(machineId, this.baseOptions)
            return resp.data
        } catch (e){
            throw this.buildError(e)
        }
    }

    async createMachine(params: paperspace.MachinesCreateRequest): Promise<paperspace.MachinesCreate200ResponseData> {
        try {
            const response = await this.client.machinesCreate(params, this.baseOptions)
            return response.data.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async deleteMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.client.machinesDelete(machineId, this.baseOptions)
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async stopMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.client.machinesStop(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain"
                }}
            ))
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async startMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.client.machinesStart(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain"
                }}
            ))
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async restartMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.client.machinesRestart(machineId, this.baseOptions)
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async listMachines(largs?: {
            after?: string, limit?: number, orderBy?: paperspace.MachinesListOrderByEnum, 
            order?: paperspace.MachinesListOrderEnum, name?: string, region?: string, 
            agentType?: string, machineType?: string}): Promise<paperspace.MachinesList200ResponseItemsInner[]> {
        try {
            const response = await this.client.machinesList(
                largs?.after, 
                largs?.limit, 
                largs?.orderBy, 
                largs?.order, 
                largs?.name, 
                largs?.region, 
                largs?.agentType, 
                largs?.machineType,
                this.baseOptions
            );
            return response.data.items;
        } catch (error) {
            console.error('Error listing machines:', error)
            throw new Error('Failed to list machines')
        }
    }

    async getMachineByName(name: string): Promise<paperspace.MachinesList200ResponseItemsInner> {
        const machines = await this.listMachines({ name: name})
        const filteredMachines = machines.filter(machine => machine.name === name)

        if (filteredMachines.length === 1) {
            return filteredMachines[0];
        } else if (filteredMachines.length === 0) {
            throw new Error(`No machine found with the name ${name}.`)
        } else {
            throw new Error(`Multiple machines found with the name ${name}.`)
        }
    }

    async isMachineInState(machineId: string, state: paperspace.MachinesCreate200ResponseDataStateEnum) {
        const machine = await this.getMachine(machineId);
        if (machine.state.toLowerCase() === state) {
            return true
        }
        return false
    }

    async waitForMachineState(machineId: string, state: paperspace.MachinesCreate200ResponseDataStateEnum, periodMs=5000, maxRetries=24): Promise<boolean> {
        let retryCount = 0

        if (await this.isMachineInState(machineId, state)) {
            return true
        }

        do {
            await new Promise(resolve => setTimeout(resolve, periodMs));
            if (await this.isMachineInState(machineId, state)) {
                return true
            }
            retryCount++
        } while (retryCount < maxRetries)

        return false

    }

    // From doc https://axios-http.com/docs/handling_errors
    private buildError(error: any) {

        if (error.response) {
            const finalError: PaperspaceClientError = {
                message: error.response.data?.message,
                status: error.response.status,
                // source: JSON.stringify(error)
            }
            return finalError
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            const finalError: PaperspaceClientError = {
                message: "No response from server",
                // source: JSON.stringify(error)
            }
            return finalError
        } else {
            // Something happened in setting up the request that triggered an Error
            const finalError: PaperspaceClientError = {
                message: error.message,
                // source: JSON.stringify(error)
            }
            return finalError
        }
    }
}