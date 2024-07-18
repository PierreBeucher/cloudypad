import { RawAxiosRequestConfig } from 'axios'
import * as paperspace from './generated-api/api'
import lodash from 'lodash';
const { merge } = lodash;
import * as fs from 'fs'
import * as path from 'path';
import * as toml from 'smol-toml'

/**
 * Wrap a client error from Axios potential error
 */
export interface PaperspaceClientError {
    message?: any
    status?: number
    source?: any
}

export interface PaperspaceClientArgs {
    apiKey: string
}

/**
 * Client wrapping generated Paperspace API code
 * See Taskfile.yml paperspace-client-gen to update underlying code 
 */
export class PaperspaceClient {

    private baseOptions: RawAxiosRequestConfig
    private machineClient: paperspace.MachineApi
    private authClient: paperspace.AuthenticationApi
    
    constructor(args: PaperspaceClientArgs) {
        
        this.baseOptions = { headers: { 
            Authorization: `Bearer ${args.apiKey}`,
        }}
        this.machineClient = new paperspace.MachineApi()
        this.authClient = new paperspace.AuthenticationApi()
        
    }

    async authSession() : Promise<paperspace.AuthSession200Response>{
        let resp;
        try {
            resp = await this.authClient.authSession(this.baseOptions)
        } catch (e){
            throw this.buildError(e)
        }

        if(!resp.data){
            throw new Error(`Paperspace authentication error, got response data '${resp.data}' with status ${resp.status} from /auth/session. (a null response with 200 is expected as "failure" for authentication on /auth/session)`)
        }

        return resp.data

    }

    async getMachine(machineId: string): Promise<paperspace.MachinesList200ResponseItemsInner> {
        try {
            const resp = await this.machineClient.machinesGet(machineId, this.baseOptions)
            return resp.data
        } catch (e){
            throw this.buildError(e)
        }
    }

    async createMachine(params: paperspace.MachinesCreateRequest): Promise<paperspace.MachinesCreate200ResponseData> {
        try {
            const response = await this.machineClient.machinesCreate(params, this.baseOptions)
            return response.data.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async deleteMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.machineClient.machinesDelete(machineId, this.baseOptions)
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async stopMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.machineClient.machinesStop(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }}
            ))
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async startMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.machineClient.machinesStart(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }}
            ))
            return response.data
        } catch (e: unknown) {
            throw this.buildError(e)
        }
    }

    async restartMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            const response = await this.machineClient.machinesRestart(machineId, merge(this.baseOptions, {
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }
        }))
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
            const response = await this.machineClient.machinesList(
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

    async machineWithNameExists(name: string) : Promise<boolean>{
        const machines = await this.listMachines({ name: name})
        return machines.length > 0
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
            console.info(`Waiting for state ${state} on ${machineId}`)
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
                source: JSON.stringify(error)
            }
            return finalError
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            const finalError: PaperspaceClientError = {
                message: "No response from server",
                source: JSON.stringify(error)
            }
            return finalError
        } else {
            // Something happened in setting up the request that triggered an Error
            const finalError: PaperspaceClientError = {
                message: error.message,
                source: JSON.stringify(error)
            }
            return finalError
        }
    }
}

/**
 * Try to fetch an existing Paperspace API Key from current environment, by priority:
 * - Using environment variable PAPERSPACE_API_KEY
 * - Using environment variable PAPERSPACE_API_KEY_FILE
 * - Directly from Paperspace CLI home under ~/.paperspace
 * 
 * paperspaceHomeDir defaults to $HOME/.paperspace, override is used for testing purpose.
 */
export function fetchApiKeyFromEnvironment(_paperspaceHome?: string): string[] {

    const paperspaceHome = path.join(_paperspaceHome ?? (process.env.HOME ?? "", '.paperspace'));

    if (process.env.PAPERSPACE_API_KEY) {
        return [ process.env.PAPERSPACE_API_KEY ];
    }

    if (process.env.PAPERSPACE_API_KEY_FILE) {
        const filePath = process.env.PAPERSPACE_API_KEY_FILE;
        if (fs.existsSync(filePath)) {
            return [ fs.readFileSync(filePath, 'utf-8').trim() ]
        } else {
            throw new Error(`PAPERSPACE_API_KEY_FILE points to non-existing file ${process.env.PAPERSPACE_API_KEY_FILE}`)
        }
    }

    const credentialsFile = path.join(paperspaceHome, 'credentials.toml');

    if (fs.existsSync(credentialsFile)) {
        const fileContent = fs.readFileSync(credentialsFile, 'utf-8');
        const parsed = toml.parse(fileContent);
        if (parsed.keys) {
            const apiKeys = Object.values(parsed.keys).filter(key => typeof key === 'string') as string[];
            if (apiKeys.length > 0) {
                return apiKeys;
            }
        }
    }
    return [];
}