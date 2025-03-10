import { getLogger, Logger } from '../log/utils'
import { createClient, Instance, Vpc, Account, Marketplace, Profile } from '@scaleway/sdk'
import { loadProfileFromConfigurationFile } from '@scaleway/configuration-loader'

interface StartStopActionOpts {
    wait?: boolean
    waitTimeoutSeconds?: number
}

export interface ScalewayVMDetails {
    commercialType: string
    name: string
    state: string
    tags?: string[]
}


const DEFAULT_START_STOP_OPTION_WAIT=false

// Generous default timeout as G instances are sometime long to stop
const DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT=60

/**
 * Available volume types for Scaleway instances.
 * 
 * Local volumes: The local volume of an Instance is an all-SSD-based storage solution, 
 * using a RAID array for redundancy and performance, hosted on the local hypervisor. 
 * On Scaleway Instances, the size of the local volume is fixed and depends on the Instance type. 
 * Some Instance types do not use local volumes and boot directly on block volumes.
 * 
 * Block volumes: Block volumes provide network-attached storage you can plug in and out of Instances like a virtual hard drive. 
 * Block volumes behave like regular disks and can be used to increase the storage of an Instance
 * 
 * See https://www.scaleway.com/en/docs/instances/concepts/#local-volumes
 */
export enum ScalewayVolumeType {
    BLOCK_SSD = "b_ssd",
    LOCAL_SSD = "l_ssd",
}

// Based on ServerState from '@scaleway/sdk/dist/api/instance/v1/types.gen'
export enum ScalewayServerState {
    Starting = "starting",
    Running = "running",
    Stopped = "stopped",
    Stopping = "stopping",
    StoppedInPlace = "stopped in place",
    Locked = "locked",
    Unknown = "unknown"
}

// Based on ServerAction from '@scaleway/sdk/dist/api/instance/v1/types.gen'
export enum ServerActionEnum {
    PowerOn = 'poweron',
    Backup = 'backup',
    StopInPlace = 'stop_in_place',
    PowerOff = 'poweroff',
    Terminate = 'terminate',
    Reboot = 'reboot',
    EnableRoutedIp = 'enable_routed_ip'
}

export interface ScalewayClientArgs {
    organizationId?: string
    projectId?: string
    zone?: string
    region?: string
}

export interface ScalewayInstanceType {
    name: string
    gpu: number
    ramGb: number
    cpu: number
}

export class ScalewayClient {


    /**
     * List available regions for Scaleway.
     * 
     * @returns List of available regions
     */
    static listRegions(): string[] {
        // Use VPC data as our instances are using VPC
        return Vpc.v2.API.LOCALITIES
    }

    /**
     * List available zones for Scaleway.
     * 
     * @returns List of available zones
     */
    static listZones(): string[] {
        // Use Instance data as we're gonna use instances
        return Instance.v1.API.LOCALITIES
    }

    /**
     * Load Scaleway profile from configuration file.
     * Mocked for unit tests
     * @returns Scaleway profile
     */
    static loadProfileFromConfigurationFile(): Profile {
        return loadProfileFromConfigurationFile()
    }

    private readonly logger: Logger
    private readonly instanceClient: Instance.v1.API
    private readonly accountProjectClient: Account.v3.ProjectAPI
    private readonly marketplaceClient: Marketplace.v2.API

    constructor(name: string, args: ScalewayClientArgs) {
        const profile = ScalewayClient.loadProfileFromConfigurationFile()
        const client = createClient({
            ...profile,
            defaultProjectId: args.projectId,
            defaultZone: args.zone,
            defaultRegion: args.region,
        })
        this.logger = getLogger(name)
        this.instanceClient = new Instance.v1.API(client)
        this.accountProjectClient = new Account.v3.ProjectAPI(client)
        this.marketplaceClient = new Marketplace.v2.API(client)
    }

    async listInstances(): Promise<ScalewayVMDetails[]> {
        this.logger.debug(`Listing Scaleway virtual machines`)

        const vms = []
        const servers = await this.instanceClient.listServers()
        for (const server of servers.servers) {
            vms.push({
                commercialType: server.commercialType,
                name: server.name,
                state: server.state,
                tags: server.tags
            })
        }

        this.logger.debug(`List virtual machines response: ${JSON.stringify(vms)}`)

        return vms
    }

    async startInstance(serverId: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Starting Scaleway virtual machine: ${serverId}`)
            await this.instanceClient.serverAction({ serverId, action: ServerActionEnum.PowerOn })
    
            if (wait) {
                this.logger.debug(`Waiting for virtual machine ${serverId} to start`)
                await this.withTimeout(this.waitForStatus(serverId, ScalewayServerState.Running), waitTimeout * 1000)
            }
        } catch (error) {
            throw new Error(`Failed to start virtual machine ${serverId}`, { cause: error })
        }
    }

    async stopInstance(serverId: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Stopping Scaleway virtual machine: ${serverId}`)
            await this.instanceClient.serverAction({ serverId, action: ServerActionEnum.PowerOff })

            if (wait) {
                this.logger.debug(`Waiting for virtual machine ${serverId} to stop`)
                await this.withTimeout(this.waitForStatus(serverId, ScalewayServerState.Stopped), waitTimeout * 1000)
            }

        } catch (error) {
            throw new Error(`Failed to stop virtual machine ${serverId}`, { cause: error })
        }
    }

    async restartInstance(serverId: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Restarting Scaleway virtual machine: ${serverId}`)
            await this.instanceClient.serverAction({ serverId, action: ServerActionEnum.Reboot })

            if (wait) {
                this.logger.debug(`Waiting for virtual machine ${serverId} to restart`)
                await this.withTimeout(this.waitForStatus(serverId, ScalewayServerState.Running), waitTimeout * 1000)
            }

        } catch (error) {
            throw new Error(`Failed to restart virtual machine ${serverId}`, { cause: error })
        }
    }

    async getInstanceStatus(serverId: string): Promise<ScalewayServerState | undefined> {
        this.logger.debug(`Getting Scaleway virtual machine state: ${serverId}`)

        try  {
            const server = await this.instanceClient.getServer({ serverId })

            if (!server.server) {
                throw new Error(`Server with id ${serverId} not found while getting status`)
            }

            this.logger.debug(`Found Scaleway virtual machine state: ${server.server.state}`)

            switch(server.server.state){
                case 'running':
                    return ScalewayServerState.Running
                case 'stopped':
                    return ScalewayServerState.Stopped
                case 'starting':
                    return ScalewayServerState.Starting
                case 'stopping':
                    return ScalewayServerState.Stopping
                default:
                    return ScalewayServerState.Unknown
            }

        } catch (error) {
            throw new Error(`Failed to get Scaleway virtual machine status: ${serverId}`, { cause: error })
        }
    }

    async listProjects(): Promise<{ name: string, id: string }[]> {
        const projects = await this.accountProjectClient.listProjects()
        return projects.projects.map(p => ({ name: p.name, id: p.id }))
    }

    async listInstanceImages(): Promise<{ name: string, id: string }[]> {
        const images = await this.marketplaceClient.listImages({
            arch: "x86_64",
            includeEol: false,
        })
        return images.images.map(i => ({ name: i.name, id: i.id }))
    }

    /**
     * List available server types with GPU.
     * 
     * @param gpuCount Exact number of GPUs to filter on
     * @returns List of available server types with GPU
     */
    async listGpuInstanceTypes(gpuCount?: number): Promise<ScalewayInstanceType[]> {
        const types = await this.instanceClient.listServersTypes()

        const gpuServerTypes: ScalewayInstanceType[] = []
        for(const [ name, type ] of Object.entries(types.servers)){
            if(type.gpu && type.gpu > 0){
                if(gpuCount && type.gpu !== gpuCount){
                    continue
                }
                gpuServerTypes.push({
                    name: name,
                    gpu: type.gpu,
                    ramGb: Math.round(type.ram / (1024 * 1024 * 1024)),
                    cpu: type.ncpus
                })
            }
        }

        return gpuServerTypes
    }

    private async waitForStatus(serverId: string, status: ScalewayServerState): Promise<void> {
        while (true) {
            const currentStatus = await this.getInstanceStatus(serverId)
            if (currentStatus === status) {
                return
            }
            await new Promise(resolve => setTimeout(resolve, 5000))
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
