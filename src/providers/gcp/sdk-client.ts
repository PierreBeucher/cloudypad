import { InstancesClient, protos, RegionsClient, MachineTypesClient, AcceleratorTypesClient, ZoneOperationsClient } from '@google-cloud/compute'
import { GoogleAuth } from 'google-auth-library'
import { getLogger, Logger } from '../../log/utils'
import { ProjectsClient, protos as rmprotos  } from '@google-cloud/resource-manager'

interface StartStopActionOpts {
    wait?: boolean
    waitTimeoutSeconds?: number
}

const DEFAULT_START_STOP_OPTION_WAIT=false

// Generous default timeout as G instances are sometime long to stop
const DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT=60

/**
 * Google VM statuses
 * Based on API reference https://cloud.google.com/compute/docs/reference/rest/v1/instances
 */
export enum GcpInstanceStatus {
    Provisioning = "PROVISIONING",
    Staging = "STAGING",
    Running = "RUNNING",
    Stopping = "STOPPING",
    Suspending = "SUSPENDING",
    Suspended = "SUSPENDED",
    Repairing = "REPAIRING",
    Terminated = "TERMINATED", // Stopped
    Unknown = "UNKNOWN"
}

export class GcpClient {

    private static readonly staticLogger =  getLogger(GcpClient.name)

    static async listProjects(): Promise<rmprotos.google.cloud.resourcemanager.v3.IProject[]> {
        GcpClient.staticLogger.debug(`Listing Google Cloud projects`)
        try {
            const projectsClient = new ProjectsClient()
            const [projects] = await projectsClient.searchProjects()
            GcpClient.staticLogger.debug(`List projects response: ${JSON.stringify(projects)}`)
            return projects
        } catch (error) {
            throw new Error(`Failed to list Google Cloud projects`, { cause: error })
        }
    }

    private readonly instances: InstancesClient
    private readonly auth: GoogleAuth
    private readonly logger: Logger
    private readonly projectId: string
    private readonly regions: RegionsClient
    private readonly machines: MachineTypesClient
    private readonly accelerators: AcceleratorTypesClient

    constructor(name: string, projectId: string){
        this.logger = getLogger(name)
        this.instances = new InstancesClient()
        this.regions = new RegionsClient()
        this.auth = new GoogleAuth()
        this.machines = new MachineTypesClient()
        this.accelerators = new AcceleratorTypesClient()
        this.projectId = projectId
    }

    async checkAuth() {
        this.logger.debug("Checking Google Cloud authentication")
        try {
            const creds = await this.auth.getApplicationDefault()
            this.logger.debug(`Google Cloud authenticated with project ${creds.projectId}`)
        } catch (e) {
            throw new Error(`Couldn't check Google Cloud authentication.` + 
                `Make sure you authenticated with Google Application Default Credentials using gcloud auth application-default login`,
                { cause: e }
            )
        }
    }

    async listInstances(): Promise<protos.google.cloud.compute.v1.IInstance[]>{
        this.logger.debug(`Listing Google Cloud instances`)
        try {
            const [instances] = await this.instances.list({})
            this.logger.debug(`List instances response: ${JSON.stringify(instances)}`)
            return instances
        } catch (error) {
            throw new Error(`Failed to list Google Cloud instances`, { cause: error })
        }
    }

    async startInstance(zone: string, instanceName: string, opts?: StartStopActionOpts){
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Starting Google Cloud instance ${instanceName}`)
            const [response] = await this.instances.start({
                instance: instanceName,
                project: this.projectId,
                zone: zone
            })
            
            if(wait){
                await this.waitOperation(response.latestResponse.name, zone, waitTimeout)
            }

            this.logger.debug(`Started Google Cloud instance ${instanceName}, response: ${JSON.stringify(response)}`)
        } catch (error) {
            throw new Error(`Failed to start GCP instance ${instanceName}`, { cause: error })
        }
    }

    async stopInstance(zone: string, instanceName: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Stopping Google Cloud instance ${instanceName}`)
            const [response] = await this.instances.stop({
                instance: instanceName,
                project: this.projectId,
                zone: zone
            })

            if(wait){
                await this.waitOperation(response.latestResponse.name, zone, waitTimeout)
            }
            
            this.logger.debug(`Stopped Google Cloud instance ${instanceName}, response: ${JSON.stringify(response)}`)
        } catch (error) {
            throw new Error(`Failed to stop Google Cloud instance ${instanceName}`, { cause: error })
        }
    }
   
    async restartInstance(zone: string, instanceName: string, opts?: StartStopActionOpts) {
        // As google-cloud SDK doesn't have a "restart" operation we need to stop, wait for full stop, and then start
        // In this context, without --wait, operation would be ambiguous as we can't run start until instance is stopped
        // We'd need to wait start operation which would make the wait flag ambiguous as without it we would still wait partially
        if(!opts?.wait) {
            throw new Error(`--wait is required to restart GCP instance.`)
        }
        await this.stopInstance(zone, instanceName, opts)
        await this.stopInstance(zone, instanceName, opts)
    }

    async listRegions(): Promise<protos.google.cloud.compute.v1.IRegion[]> {
        this.logger.debug(`Listing Google Cloud regions`)
        try {
            const [regions] = await this.regions.list({ project: this.projectId})
            this.logger.debug(`List regions response: ${JSON.stringify(regions)}`)
            return regions
        } catch (error) {
            throw new Error(`Failed to list Google Cloud regions`, { cause: error })
        }
    }
    
    async listRegionZones(regionName: string): Promise<string[]> {
        this.logger.debug(`Listing Google Cloud zones in region ${regionName}`)
        try {
            const [region] = await this.regions.get({ project: this.projectId, region: regionName})
            this.logger.debug(`Listing zones for region ${regionName}, got region response: ${JSON.stringify(region)}`)
            
            if (!region.zones){
                throw new Error(`Unexpected zones data on Region response: ${JSON.stringify(region)}`)
            }

            // Regions are formatted like https://www.googleapis.com/compute/v1/projects/crafteo-sandbox/zones/europe-west1-b
            // Only return names
            return region.zones.map(z => z.substring(z.lastIndexOf('/')+1, z.length))
        } catch (error) {
            throw new Error(`Failed to list Google Cloud zones in region ${regionName}`, { cause: error })
        }
    }

    async listMachineTypes(zone: string): Promise<protos.google.cloud.compute.v1.IMachineType[]> {
        this.logger.debug(`Listing Google Cloud machine types in zone ${zone}`)
        try {
            const [machineTypes] = await this.machines.list({ project: this.projectId, zone: zone })
            this.logger.debug(`List machine types response: ${JSON.stringify(machineTypes.lastIndexOf)} elements`)
            this.logger.trace(`List machine types response: ${JSON.stringify(machineTypes)}`) // very bverbose, use trace
            return machineTypes
        } catch (error) {
            throw new Error(`Failed to list Google Cloud machine types in zone ${zone}`, { cause: error })
        }
    }

    async listAcceleratorTypes(zone: string): Promise<protos.google.cloud.compute.v1.IAcceleratorType[]> {
        this.logger.debug(`Listing Google Cloud accelerator types in zone ${zone}`)
        try {
            const [acceleratorTypes] = await this.accelerators.list({ project: this.projectId, zone: zone })
            this.logger.debug(`List accelerator types response: ${JSON.stringify(acceleratorTypes)}`)
            return acceleratorTypes
        } catch (error) {
            throw new Error(`Failed to list Google Cloud accelerator types in zone ${zone}`, { cause: error })
        }
    }

    async getInstanceState(zone: string, instanceId: string): Promise<GcpInstanceStatus | undefined> {
        this.logger.debug(`Describing instance status for ${instanceId}`)
        
        try {
            this.logger.debug(`Getting Google Cloud instance status for ${instanceId}`)
            const [instance] = await this.instances.get({
                instance: instanceId,
                project: this.projectId,
                zone: zone
            })

            switch(instance.status) {
                case GcpInstanceStatus.Provisioning:
                    return GcpInstanceStatus.Provisioning;
                case GcpInstanceStatus.Staging:
                    return GcpInstanceStatus.Staging;
                case GcpInstanceStatus.Running:
                    return GcpInstanceStatus.Running;
                case GcpInstanceStatus.Stopping:
                    return GcpInstanceStatus.Stopping;
                case GcpInstanceStatus.Suspending:
                    return GcpInstanceStatus.Suspending;
                case GcpInstanceStatus.Suspended:
                    return GcpInstanceStatus.Suspended;
                case GcpInstanceStatus.Repairing:
                    return GcpInstanceStatus.Repairing;
                case GcpInstanceStatus.Terminated:
                    return GcpInstanceStatus.Terminated;
                case GcpInstanceStatus.Unknown:
                default:
                    return GcpInstanceStatus.Unknown;
            }

            
        } catch (error) {
            throw new Error(`Failed to get instance ${instanceId} status`, { cause: error })
        }
    }

    private async waitOperation(operationName: string, zone: string, waitTimeoutSeconds?: number): Promise<void> {
        const operationsClient = new ZoneOperationsClient()
        const startTime = Date.now()
        const timeout = (waitTimeoutSeconds ?? 300) * 1000 // Default timeout 300 seconds if not specified

        this.logger.debug(`Waiting for operation ${operationName} in zone ${zone} to complete`)

        let [operation] = await operationsClient.get({
            operation: operationName,
            project: this.projectId,
            zone: zone
        })

        while (operation.status !== "DONE") {

            [operation] = await operationsClient.get({
                operation: operationName,
                project: this.projectId,
                zone: zone
            })

            this.logger.debug(`Checking operation ${operationName} status in ${zone}`)

            if (Date.now() - startTime > timeout) {
                throw new Error(`Operation ${operationName} timed out after ${waitTimeoutSeconds} seconds`)
            }

            await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 second before checking again
        }

        if (operation.status === 'DONE') {
            if (operation.error) {
                throw new Error(`Operation ${operationName} failed.`, { cause: operation.error })
            }
            this.logger.debug(`Operation ${operationName} completed successfully`)
        }

    }


}
