import { RawAxiosRequestConfig } from 'axios'
import * as paperspace from './generated-api/api'
import lodash from 'lodash'
const { merge } = lodash
import * as fs from 'fs'
import * as path from 'path'
import * as toml from 'smol-toml'
import { buildAxiosError, isAxios404NotFound } from '../../../tools/axios'
import { getLogger, Logger } from '../../../log/utils'
import { machine } from 'os'

export interface PaperspaceClientArgs {
    name: string
    apiKey: string
}

const staticLogger = getLogger("PaperspaceClientStatic")

/**
 * Paperspace machine representation.
 */
export interface PaperspaceMachine {
    id: string
    name: string
    state: string
    machineType: string
    privateIp?: string
    publicIp?: string
    publicIpType: string
}

export interface PaperspaceIp {
    ip: string
    assignedMachineId?: string
}

export interface PaperspaceAuthResponse {
    user: {
        email: string,
        id: string
    }
    team: {
        namespace: string
        id: string
    }
}
/**
 * Client wrapping generated Paperspace API code
 * See Taskfile.yml paperspace-client-gen to update underlying code 
 */
export class PaperspaceClient {

    private readonly baseOptions: RawAxiosRequestConfig
    private readonly machineClient: paperspace.MachineApi
    private readonly authClient: paperspace.AuthenticationApi
    private readonly publicIpClient: paperspace.PublicIPsApi 
    private readonly name: string
    private readonly logger: Logger 

    constructor(args: PaperspaceClientArgs) {
        
        this.baseOptions = { headers: { 
            Authorization: `Bearer ${args.apiKey}`,
        }}
        this.machineClient = new paperspace.MachineApi()
        this.authClient = new paperspace.AuthenticationApi()
        this.publicIpClient = new paperspace.PublicIPsApi()
        this.name = args.name
        this.logger = getLogger(args.name)
    }

    async checkAuth() : Promise<PaperspaceAuthResponse>{

        this.logger.debug(`Authenticating session...`)

        let resp
        try {
            resp = await this.authClient.authSession(this.baseOptions)

            this.logger.debug(`Auth session response: ${JSON.stringify(resp.data)}`)

        } catch (e){
            throw buildAxiosError(e)
        }

        if(!resp.data){
            throw new Error(`Paperspace authentication error, got response data '${resp.data}' with status ${resp.status} from /auth/session. (a null response with 200 is expected as "failure" for authentication on /auth/session)`)
        }

        return {
            team: {
                id: resp.data.team.id,
                namespace: resp.data.team.namespace,
            }, 
            user: {
                email: resp.data.user.email,
                id: resp.data.user.id,
            }
        }

    }

    async getMachine(machineId: string): Promise<PaperspaceMachine> {
        try {
            this.logger.debug(`Get machine: ${machineId}`)

            const resp = await this.machineClient.machinesGet(machineId, this.baseOptions)

            this.logger.debug(`Get machine response: ${resp.status}`)
                        
            return this.innerInterfaceToMachine(resp.data)
        } catch (e){
            throw buildAxiosError(e)
        }
    }

    async listPublicIps(args?: { after?: string, limit?: number, orderBy?: paperspace.PublicIpsListOrderByEnum, 
            order?: paperspace.PublicIpsListOrderEnum, region?: paperspace.PublicIpsListRegionParameter }): Promise<PaperspaceIp[]>{
            
        const allIps: PaperspaceIp[] = []
        const result = await this.publicIpClient.publicIpsList(
            args?.after,
            args?.limit,
            args?.orderBy,
            args?.order,
            args?.region,
            this.baseOptions
        )

        for (const ipData of result.data.items){
            allIps.push(this.innerInterfaceToIp(ipData))
        }

        if(result.data.hasMore) {
            const moreIps = await this.listPublicIps({ ...args, after: result.data.nextPage})
            allIps.push(...moreIps)
        }

        return allIps
    }

    /**
     * Try to get a Public IP. 
     * @param ip 
     * @returns IP or undefined if IP not found
     */
    async getPublicIp(ip: string): Promise<PaperspaceIp | undefined>{

        // GET:public-ips/{ip} not available on Paperspace API
        // Searching with list instead
        const ips = await this.listPublicIps()
        return ips.find(item => item.ip == ip)
    }

    async releasePublicIp(ip: string): Promise<void>{
        try {
            this.logger.debug(`Release Public IP: ${ip}`)

            const resp = await this.publicIpClient.publicIpsRelease(ip, this.baseOptions)

            this.logger.debug(`Release public IP '${ip}' response: ${resp.status}`)
        } catch (e){
            throw buildAxiosError(e)
        }
    }

    async createMachine(params: paperspace.MachinesCreateRequest): Promise<PaperspaceMachine> {
        try {
            // check machine already exists
            const alreadyExists = await this.machineWithNameExists(params.name)
            if(alreadyExists){
                throw new Error(`Machine ${params.name} already exists.`)
            }

            this.logger.debug(`Creating machine: ${JSON.stringify(params)}`)

            const response = await this.machineClient.machinesCreate(params, this.baseOptions)

            this.logger.debug(`Creating machine ${params.name} response: ${JSON.stringify(response.status)}`)

            return this.innerInterfaceToMachine(response.data.data)
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    /**
     * Delete a Paperspace machine. If machine has a static public IP and releasePublicIp is true, static IP is released as well.
     * Otherwise public IP (if any) attached to machine is left untouched. 
     * @param machineId 
     * @param releasePublicIp
     * @returns 
     */
    async deleteMachine(machineId: string, releasePublicIp?: boolean): Promise<void> {
        try {

            if(releasePublicIp){
                const m = await this.getMachine(machineId)
                if(m.publicIp && m.publicIpType == paperspace.MachinesList200ResponseItemsInnerPublicIpTypeEnum.Static) {
                    this.logger.debug(`Deleting machine ${machineId}: Releasing static public IP ${m.publicIp}`)
                    await this.releasePublicIp(m.publicIp)
                } else {
                    this.logger.debug(`Deleting machine ${machineId}: no static public IP on machine, no need to release it.`)
                }
            }
            
            this.logger.debug(`Deleting machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesDelete(machineId, this.baseOptions)

            this.logger.debug(`Deleting machine ${machineId} response: ${JSON.stringify(response.status)}`)
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async stopMachine(machineId: string): Promise<void> {
        try {
            
            this.logger.debug(`Stopping machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesStop(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }}
            ))

            this.logger.debug(`Stopping machine ${machineId} response: ${JSON.stringify(response.status)}`)
        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async startMachine(machineId: string): Promise<void> {
        try {
            this.logger.debug(`Starting machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesStart(machineId, merge(this.baseOptions, { 
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }}
            ))

            this.logger.debug(`Starting machine ${machineId} response: ${JSON.stringify(response.status)}`)

        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async restartMachine(machineId: string): Promise<void> {
        try {
            this.logger.debug(`Restarting machine: ${JSON.stringify(machineId)}`)

            const response = await this.machineClient.machinesRestart(machineId, merge(this.baseOptions, {
                headers: {
                    "Content-Type": "text/plain" // Need this header otherwise API fails
                }
            }))

            this.logger.debug(`Restarting machine ${machineId} response: ${JSON.stringify(response.status)}`)

        } catch (e: unknown) {
            throw buildAxiosError(e)
        }
    }

    async listMachines(largs?: {
            after?: string, limit?: number, orderBy?: paperspace.MachinesListOrderByEnum, 
            order?: paperspace.MachinesListOrderEnum, name?: string, region?: string, 
            agentType?: string, machineType?: string}): Promise<PaperspaceMachine[]> {
        try {

            this.logger.debug(`Listing machines with params: ${JSON.stringify([ 
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

            const result: PaperspaceMachine[] = []
            for(const m of response.data.items){
                result.push(this.innerInterfaceToMachine(m))
            }
            return result

        } catch (error) {
            this.logger.error('Error listing machines:', error)
            throw new Error('Failed to list machines')
        }
    }

    async machineExists(machineId: string) : Promise<boolean>{
        try {
            this.logger.debug(`Checking machine ${machineId} existence`)
            const machine = await this.getMachine(machineId)
            this.logger.debug(`Machine ${machineId} exists with name ${machine.name}`)
        } catch (e){

            if(isAxios404NotFound(e)) {
                return false
            }
            
            this.logger.error(`Error checking machine ${machineId} existence:`, e)
            throw e
        }   
        return true
    }

    async publicIpExists(ip: string){
        try {
            this.logger.debug(`Checking public IP ${ip} existence`)
            const foundIp = await this.getPublicIp(ip)
            this.logger.debug(`Public IP ${ip} exists: ${JSON.stringify(foundIp)}`)

            return foundIp !== undefined
        } catch (e){
            
            this.logger.error(`Error checking public IP ${ip} existence:`, e)
            throw e 
        }
    }

    async machineWithNameExists(name: string) : Promise<boolean>{
        const machines = await this.listMachines({ name: name})
        return machines.length > 0
    }

    async getMachineByName(name: string): Promise<PaperspaceMachine> {
        const machines = await this.listMachines({ name: name})
        const filteredMachines = machines.filter(machine => machine.name === name)

        if (filteredMachines.length === 1) {
            return filteredMachines[0]
        } else if (filteredMachines.length === 0) {
            throw new Error(`No machine found with the name ${name}.`)
        } else {
            throw new Error(`Multiple machines found with the name ${name}.`)
        }
    }

    async isMachineInState(machineId: string, state: paperspace.MachinesCreate200ResponseDataStateEnum) {
        const machine = await this.getMachine(machineId)
        if (machine.state.toLowerCase() === state) {
            return true
        }
        return false
    }

    async waitForMachineState(machineId: string, state: paperspace.MachinesCreate200ResponseDataStateEnum, periodMs=5000, maxRetries=24): Promise<boolean> {

        this.logger.debug(`Waiting for machine ${machine} state: ${state} (period: ${periodMs}, maxRetries: ${maxRetries})`)

        let retryCount = 0
        
        if (await this.isMachineInState(machineId, state)) {
            return true
        }

        do {
            this.logger.debug(`Waiting for machine ${machineId} state ${state} (retry count: ${retryCount})`)

            await new Promise(resolve => setTimeout(resolve, periodMs))
            if (await this.isMachineInState(machineId, state)) {
                return true
            }
            retryCount++
        } while (retryCount < maxRetries)

        return false

    }

    private innerInterfaceToIp(data: paperspace.PublicIpsList200ResponseItemsInner): PaperspaceIp {
        return { ip: data.ip, assignedMachineId: data.assignedMachineId}
    }

    private innerInterfaceToMachine(inner: paperspace.MachinesList200ResponseItemsInner): PaperspaceMachine {
        const machine: PaperspaceMachine = {
            id: inner.id,
            name: inner.name,
            state: inner.state,
            machineType: inner.machineType,
            privateIp: inner.privateIp ?? undefined,
            publicIp: inner.publicIp ?? undefined,
            publicIpType: inner.publicIpType
        }

        return machine
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

    staticLogger.trace(`Fetching Paperspace API key from environment.`)

    if (process.env.PAPERSPACE_API_KEY) {
        staticLogger.trace(`Found Paperspace API key as environment variable ${process.env.PAPERSPACE_API_KEY}`)
        return [ process.env.PAPERSPACE_API_KEY ]
    }

    if (process.env.PAPERSPACE_API_KEY_FILE) {
        staticLogger.trace(`Checking Paperspace API key in file ${process.env.PAPERSPACE_API_KEY_FILE}`)

        const filePath = process.env.PAPERSPACE_API_KEY_FILE
        if (fs.existsSync(filePath)) {
            staticLogger.trace(`Found Paperspace API key in file ${process.env.PAPERSPACE_API_KEY_FILE}`)
            return [ fs.readFileSync(filePath, 'utf-8').trim() ]
        } else {
            throw new Error(`PAPERSPACE_API_KEY_FILE points to non-existing file ${process.env.PAPERSPACE_API_KEY_FILE}`)
        }
    }

    const paperspaceHomeKeys = fetchApiKeyFromPaperspaceHome(_paperspaceHome)
    if(paperspaceHomeKeys.length > 0){
        return paperspaceHomeKeys
    }

    staticLogger.trace(`No Paperspace API key found in environment.`)

    return []
}

export function fetchApiKeyFromPaperspaceHome(_paperspaceHome?: string): string[] {
    staticLogger.trace(`Fetching Paperspace API key from environment (provided optional Paperspace home: ${_paperspaceHome})`)
    
    const paperspaceHome = path.join(_paperspaceHome ?? (process.env.HOME ?? "", '.paperspace'))
    const credentialsFile = path.join(paperspaceHome, 'credentials.toml')

    staticLogger.trace(`Checking Paperspace API credentials file ${credentialsFile}`)

    if (fs.existsSync(credentialsFile)) {
        const fileContent = fs.readFileSync(credentialsFile, 'utf-8')
        const parsed = toml.parse(fileContent)
        if (parsed.keys) {
            const apiKeys = Object.values(parsed.keys).filter(key => typeof key === 'string') as string[]
            
            staticLogger.trace(`Reading Paperspace API credentials file: found ${apiKeys.length} keys`)
            
            if (apiKeys.length > 0) {
                return apiKeys
            }
        }
    }

    staticLogger.trace(`No Paperspace API key found in Paperspace home ${paperspaceHome}.`)

    return []
}
