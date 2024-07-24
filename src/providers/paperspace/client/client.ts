import { RawAxiosRequestConfig } from 'axios'
import * as paperspace from './generated-api/api'
import lodash from 'lodash';
const { merge } = lodash;
import * as fs from 'fs'
import * as path from 'path';
import * as toml from 'smol-toml'
import { buildAxiosError } from '../../../tools/axios';
import { getLogger, Logger } from '../../../log/utils';
import { machine } from 'os';

export interface PaperspaceClientArgs {
    name: string
    apiKey: string
}

const staticLogger = getLogger("PaperspaceClientStatic")


/**
 * Client wrapping generated Paperspace API code
 * See Taskfile.yml paperspace-client-gen to update underlying code 
 */
export class PaperspaceClient {

    private readonly baseOptions: RawAxiosRequestConfig
    private readonly machineClient: paperspace.MachineApi
    private readonly authClient: paperspace.AuthenticationApi
    private readonly name: string
    private readonly logger: Logger

    constructor(args: PaperspaceClientArgs) {
        
        this.baseOptions = { headers: { 
            Authorization: `Bearer ${args.apiKey}`,
        }}
        this.machineClient = new paperspace.MachineApi()
        this.authClient = new paperspace.AuthenticationApi()
        this.name = args.name
        this.logger = getLogger(args.name)
    }

    async authSession() : Promise<paperspace.AuthSession200Response>{

        this.logger.trace(`Authenticating session...`)

        let resp;
        try {
            resp = await this.authClient.authSession(this.baseOptions)

            this.logger.debug(`Auth ession response: ${JSON.stringify(resp.data)}`)

        } catch (e){
            throw buildAxiosError(e)
        }

        if(!resp.data){
            throw new Error(`Paperspace authentication error, got response data '${resp.data}' with status ${resp.status} from /auth/session. (a null response with 200 is expected as "failure" for authentication on /auth/session)`)
        }

        return resp.data

    }

    async getMachine(machineId: string): Promise<paperspace.MachinesList200ResponseItemsInner> {
        try {
            this.logger.trace(`Get machine: ${machineId}`)

            const resp = await this.machineClient.machinesGet(machineId, this.baseOptions)

            this.logger.trace(`Get machine response: ${resp.status}`)

            return resp.data
        } catch (e){
            throw buildAxiosError(e)
        }
    }

    async createMachine(params: paperspace.MachinesCreateRequest): Promise<paperspace.MachinesCreate200ResponseData> {
        try {
            this.logger.trace(`Creating machine: ${JSON.stringify(params)}`)

            const response = await this.machineClient.machinesCreate(params, this.baseOptions)

            this.logger.trace(`Creating machine ${params.name} response: ${JSON.stringify(response.status)}`)

            return response.data.data
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async deleteMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            this.logger.trace(`Deleting machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesDelete(machineId, this.baseOptions)

            this.logger.trace(`Deleting machine ${machineId} response: ${JSON.stringify(response.status)}`)

            return response.data
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async stopMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            
            this.logger.trace(`Stopping machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesStop(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }}
            ))

            this.logger.trace(`Stopping machine ${machineId} response: ${JSON.stringify(response.status)}`)

            return response.data
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async startMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            this.logger.trace(`Starting machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesStart(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }}
            ))

            this.logger.trace(`Starting machine ${machineId} response: ${JSON.stringify(response.status)}`)

            return response.data
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async restartMachine(machineId: string): Promise<paperspace.MachinesCreate200Response> {
        try {
            this.logger.trace(`Restarting machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesRestart(machineId, merge(this.baseOptions, {
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }
            }))

            this.logger.trace(`Restarting machine ${machineId} response: ${JSON.stringify(response.status)}`)

            return response.data
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async listMachines(largs?: {
            after?: string, limit?: number, orderBy?: paperspace.MachinesListOrderByEnum, 
            order?: paperspace.MachinesListOrderEnum, name?: string, region?: string, 
            agentType?: string, machineType?: string}): Promise<paperspace.MachinesList200ResponseItemsInner[]> {
        try {

            this.logger.trace(`Listing machines with params: ${JSON.stringify([ 
                largs?.after, 
                largs?.limit, 
                largs?.orderBy, 
                largs?.order, 
                largs?.name, 
                largs?.region, 
                largs?.agentType, 
                largs?.machineType,
            ])}`)

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
            )

            return response.data.items;
        } catch (error) {
            this.logger.error('Error listing machines:', error)
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

        this.logger.trace(`Waiting for machine ${machine} state: ${state} (period: ${periodMs}, maxRetries: ${maxRetries})`)

        let retryCount = 0
        
        if (await this.isMachineInState(machineId, state)) {
            return true
        }

        do {
            this.logger.trace(`Waiting for machine ${machineId} state ${state} (retry count: ${retryCount})`)

            await new Promise(resolve => setTimeout(resolve, periodMs));
            if (await this.isMachineInState(machineId, state)) {
                return true
            }
            retryCount++
        } while (retryCount < maxRetries)

        return false

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

    staticLogger.trace(`Fetching Paperspace API key from environment (provided optional Paperspace home: ${_paperspaceHome})`)
    
    const paperspaceHome = path.join(_paperspaceHome ?? (process.env.HOME ?? "", '.paperspace'));

    staticLogger.trace(`Fetching Paperspace API key from environment, Paperspace home: ${paperspaceHome}`)

    if (process.env.PAPERSPACE_API_KEY) {
        staticLogger.trace(`Found Paperspace API key as environment variable ${process.env.PAPERSPACE_API_KEY}`)
        return [ process.env.PAPERSPACE_API_KEY ];
    }

    if (process.env.PAPERSPACE_API_KEY_FILE) {
        staticLogger.trace(`Checking Paperspace API key in file ${process.env.PAPERSPACE_API_KEY_FILE}`)

        const filePath = process.env.PAPERSPACE_API_KEY_FILE;
        if (fs.existsSync(filePath)) {
            staticLogger.trace(`Found Paperspace API key in file ${process.env.PAPERSPACE_API_KEY_FILE}`)
            return [ fs.readFileSync(filePath, 'utf-8').trim() ]
        } else {
            throw new Error(`PAPERSPACE_API_KEY_FILE points to non-existing file ${process.env.PAPERSPACE_API_KEY_FILE}`)
        }
    }

    const credentialsFile = path.join(paperspaceHome, 'credentials.toml');

    staticLogger.trace(`Checking Paperspace API credentials file ${credentialsFile}`)

    if (fs.existsSync(credentialsFile)) {
        const fileContent = fs.readFileSync(credentialsFile, 'utf-8');
        const parsed = toml.parse(fileContent);
        if (parsed.keys) {
            const apiKeys = Object.values(parsed.keys).filter(key => typeof key === 'string') as string[];
            
            staticLogger.trace(`Reading Paperspace API credentials file: found ${apiKeys.length} keys`)
            
            if (apiKeys.length > 0) {
                return apiKeys;
            }
        }
    }

    staticLogger.trace(`No Paperspace API key found in environment.`)

    return [];
}