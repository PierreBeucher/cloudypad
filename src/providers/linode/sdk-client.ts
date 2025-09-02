import { getLogger, Logger } from '../../log/utils'
import { 
    getLinodes, 
    getLinode, 
    linodeBoot, 
    linodeShutdown, 
    linodeReboot,
    getRegions,
    getLinodeTypes,
    createLinode,
    deleteLinode,
} from '@linode/api-v4'
import type { Linode, LinodeStatus } from '@linode/api-v4'
import { getAccountInfo } from '@linode/api-v4/lib/account'
import { setToken as internalSetToken } from '@linode/api-v4'

interface StartStopActionOpts {
    wait?: boolean
    waitTimeoutSeconds?: number
}

export interface LinodeVMDetails {
    type: string
    label: string
    status: LinodeStatus
    tags?: string[]
    id: number
}

const DEFAULT_START_STOP_OPTION_WAIT = false
const DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT = 60

export type LinodeInstanceStatus = LinodeStatus

export interface LinodeClientArgs {
    region?: string,
}

export interface LinodeInstanceType {
    id: string
    label: string
    disk: number
    memory: number
    vcpus: number
    gpus: number
}

/**
 * LinodeClient is a wrapper around the Linode API client.
 * As per Linode client interface, the only way to provide token is through a globally set variable.
 * While this is far from a clean approach, it is the only way to use Linode client as per the provided interface.
 * 
 * Token can be set:
 * - via static method `setToken` (takes priority over environment variable)
 * - via environment variable `LINODE_TOKEN`
 * 
 * If token is not set, an error will be thrown by constructor.
 */
export class LinodeClient {

    private static token?: string

    /**
     * Set the Linode API token globally for the client
     */
    static setToken(token: string): void {
        LinodeClient.token = token
        internalSetToken(token)
    }

    /**
     * Check if token is set and setup from environment variable if not.
     * This ensure the Linode library as a proper token set.
     */
    private static checkAndSetupToken() {

        // set token from evn var if not already set and env var exists
        if(!LinodeClient.token && process.env.LINODE_TOKEN) {
            LinodeClient.setToken(process.env.LINODE_TOKEN)
        }

        if(!LinodeClient.token) {
            throw new Error('No Linode token found. Set LINODE_TOKEN environment variable or use LinodeClient.setToken.')
        }

    }

    private logger: Logger
    private region?: string

    constructor(args?: LinodeClientArgs) {
        this.logger = getLogger(`LinodeClient`)
        this.region = args?.region
        
        // ensure token is set
        LinodeClient.checkAndSetupToken()
    }

    /**
     * Check if Linode authentication is valid.
     */
    async checkAuth(): Promise<void> {
        this.logger.debug(`Checking Linode authentication...`)
        this.logger.debug(`Token: ${LinodeClient.token}`)
        const account = await getAccountInfo()
        this.logger.debug(`Linode authentication check OK for account: '${account.email}'`)
    }

    /**
     * List available regions for Linode.
     * 
     * @returns List of available regions
     */
    async listRegions(): Promise<string[]> {
        try {
            const regionsResponse = await getRegions()
            return regionsResponse.data.map(region => region.id)
        } catch (error) {
            throw new Error(`Failed to list Linode regions`, { cause: error })
        }
    }

    /**
     * Start a Linode instance
     */
    async startInstance(instanceId: string | number, opts?: StartStopActionOpts): Promise<void> {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds ?? DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT
        
        const safeId = await this.instanceIdStringNumberToNumber(instanceId)

        this.logger.debug(`Starting Linode instance: ${instanceId}`)
        
        try {
            await linodeBoot(safeId)
            
            if (wait) {
                this.logger.debug(`Waiting for Linode instance ${instanceId} to start`)
                await this.withTimeout(this.waitForStatus(safeId, 'running'), waitTimeout * 1000)
            }
        } catch (error) {
            throw new Error(`Failed to start Linode instance ${instanceId}`, { cause: error })
        }
    }

    /**
     * Stop a Linode instance
     */
    async stopInstance(instanceId: string | number, opts?: StartStopActionOpts): Promise<void> {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds ?? DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT
        const safeId = await this.instanceIdStringNumberToNumber(instanceId)

        this.logger.debug(`Stopping Linode instance: ${instanceId}`)
        
        try {
            await linodeShutdown(safeId)
            
            if (wait) {
                this.logger.debug(`Waiting for Linode instance ${instanceId} to stop`)
                await this.withTimeout(this.waitForStatus(safeId, 'stopped'), waitTimeout * 1000)
            }
        } catch (error) {
            throw new Error(`Failed to stop Linode instance ${instanceId}`, { cause: error })
        }
    }

    /**
     * Restart a Linode instance
     */
    async restartInstance(instanceId: string | number, opts?: StartStopActionOpts): Promise<void> {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds ?? DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT
        const safeId = await this.instanceIdStringNumberToNumber(instanceId)

        this.logger.debug(`Restarting Linode instance: ${instanceId}`)
        
        try {
            await linodeReboot(safeId)
            
            if (wait) {
                this.logger.debug(`Waiting for Li   node instance ${instanceId} to restart`)
                await this.withTimeout(this.waitForStatus(safeId, 'running'), waitTimeout * 1000)
            }
        } catch (error) {
            throw new Error(`Failed to restart Linode instance ${instanceId}`, { cause: error })
        }
    }

    /**
     * Get current status of a Linode instance
     */
    async getInstanceStatus(instanceId: string | number): Promise<LinodeInstanceStatus | undefined> {
        this.logger.debug(`Getting Linode instance status: ${instanceId}`)
        try {
            const safeId = await this.instanceIdStringNumberToNumber(instanceId)
            const linode = await getLinode(safeId)
            return linode.status
        } catch (error) {
            throw new Error(`Failed to get Linode instance status: ${instanceId}`, { cause: error })
        }
    }

    /**
     * List all Linode instances
     */
    async listInstances(): Promise<LinodeVMDetails[]> {
        this.logger.debug("Listing all Linode instances")
        try {
            const linodes = await getLinodes()
            return linodes.data.map(linode => ({
                type: linode.type || 'unknown',
                label: linode.label || `linode-${linode.id}`,
                status: linode.status,
                tags: linode.tags || [],
                id: linode.id
            }))
        } catch (error) {
            this.logger.error("Failed to list Linode instances", error)
            return []
        }
    }

    /**
     * List available instance types
     */
    async listInstanceTypes(): Promise<LinodeInstanceType[]> {
        try {
            const linodeTypesResponse = await getLinodeTypes()
            return linodeTypesResponse.data.map(type => ({
                id: type.id,
                label: type.label || type.id, // Use ID as fallback if label is null
                disk: type.disk,
                memory: type.memory,
                vcpus: type.vcpus,
                gpus: type.gpus
            }))
        } catch (error) {
            throw new Error(`Failed to list Linode instance types`, { cause: error })
        }
    }

    async createInstance(args: { region: string, type: string, image: string, label: string, rootPassword?: string }): Promise<Linode> {
        try {
            return createLinode({
                label: args.label,
                region: args.region,
                type: args.type,
                image: args.image,
                root_pass: args.rootPassword,
            })
        } catch (error) {
            throw new Error(`Failed to create Linode instance`, { cause: error })
        }
    }

    async deleteInstance(instanceId: string | number): Promise<void> {
        try {
            const safeId = await this.instanceIdStringNumberToNumber(instanceId)
            await deleteLinode(safeId)
        } catch (error) {
            throw new Error(`Failed to delete Linode instance`, { cause: error })
        }
    }

    /**
     * Get details for a specific Linode instance
     */
    async getLinode(instanceId: string | number): Promise<Linode | undefined> {

        this.logger.debug(`Getting Linode instance details: ${instanceId}`)

        try {
            const safeId = await this.instanceIdStringNumberToNumber(instanceId)
            const linode = await getLinode(safeId)
            return linode
        } catch (error) {
            throw new Error(`Failed to get Linode instance details: ${instanceId}`, { cause: error })
        }
    }

    private async waitForStatus(instanceId: number, status: LinodeInstanceStatus): Promise<void> {
        while (true) {
            const currentStatus = await this.getInstanceStatus(instanceId)
            if (currentStatus === status) {
                return
            }
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    }

    /**
     * Safely convert string to number. As Linode instance ID may be provided as string or number,
     * this method ensures a proper number is returned or throws.
     */
    private async instanceIdStringNumberToNumber(instanceId: string | number): Promise<number> {
        if(typeof instanceId === 'number') {
            return instanceId
        } else {
            const result = Number(instanceId)
            if(isNaN(result)) {
                throw new Error(`Instance ID is not a number: ${instanceId}`)
            }
            return result
        }
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        if (!timeoutMs) {
            return promise
        }

        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs} ms`))
            }, timeoutMs)

            promise
                .then((result) => {
                    clearTimeout(timeoutId)
                    resolve(result)
                })
                .catch((error) => {
                    clearTimeout(timeoutId)
                    reject(error)
                })
        })
    }
} 