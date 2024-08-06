import { InstancesClient, protos, RegionsClient, MachineTypesClient, AcceleratorTypesClient } from '@google-cloud/compute'
import { GoogleAuth } from 'google-auth-library'
import { getLogger, Logger } from '../log/utils'
import { ProjectsClient, protos as rmprotos  } from '@google-cloud/resource-manager'

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
            GcpClient.staticLogger.error(`Failed to list Google Cloud projects:`, error)
            throw error
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

    async checkGcpAuth() {
        this.logger.debug("Checking Google Cloud authentication")
        try {
            const creds = await this.auth.getApplicationDefault()
            this.logger.debug(`Google Cloud authenticated with project ${creds.projectId}`)
        } catch (e) {
            this.logger.error(`Couldn't check Google Cloud authentication: ${JSON.stringify(e)}`)
            this.logger.error(`Is your local Google Cloud authentication configured ?`)
            
            throw new Error(`Couldn't check Google Cloud authentication: ${JSON.stringify(e)}`)
        }
    }

    async listInstances(): Promise<protos.google.cloud.compute.v1.IInstance[]>{
        this.logger.debug(`Listing Google Cloud instances`)
        try {
            const [instances] = await this.instances.list({})
            this.logger.debug(`List instances response: ${JSON.stringify(instances)}`)
            return instances
        } catch (error) {
            this.logger.error(`Failed to list Google Cloud instances:`, error)
            throw error
        }
    }

    async startInstance(zone: string, instanceName: string){
        try {
            this.logger.debug(`Starting Google Cloud instance ${instanceName}`)
            const [result] = await this.instances.start({
                instance: instanceName,
                project: this.projectId,
                zone: zone
            })
            this.logger.debug(`Started Google Cloud instance ${instanceName}, response: ${JSON.stringify(result)}`)
        } catch (error) {
            this.logger.error(`Failed to start GCP instance ${instanceName}:`, error)
            throw error
        }
    }

    async stopInstance(zone: string, instanceName: string) {
        try {
            this.logger.debug(`Stopping Google Cloud instance ${instanceName}`)
            const [result] = await this.instances.stop({
                instance: instanceName,
                project: this.projectId,
                zone: zone
            })
            this.logger.debug(`Stopped Google Cloud instance ${instanceName}, response: ${JSON.stringify(result)}`)
        } catch (error) {
            this.logger.error(`Failed to stop Google Cloud instance ${instanceName}:`, error)
            throw error
        }
    }
    
    async restartInstance(zone: string, instanceName: string) {
        throw new Error("Not implemented yet. " + instanceName)
    }

    async listRegions(): Promise<protos.google.cloud.compute.v1.IRegion[]> {
        this.logger.debug(`Listing Google Cloud regions`)
        try {
            const [regions] = await this.regions.list({ project: this.projectId})
            this.logger.debug(`List regions response: ${JSON.stringify(regions)}`)
            return regions
        } catch (error) {
            this.logger.error(`Failed to list Google Cloud regions:`, error)
            throw error
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
            this.logger.error(`Failed to list Google Cloud zones in region ${regionName}:`, error)
            throw error
        }
    }

    async listMachineTypes(zone: string): Promise<protos.google.cloud.compute.v1.IMachineType[]> {
        this.logger.debug(`Listing Google Cloud machine types in zone ${zone}`)
        try {
            const [machineTypes] = await this.machines.list({ project: this.projectId, zone: zone })
            this.logger.debug(`List machine types response: ${JSON.stringify(machineTypes)}`)
            return machineTypes
        } catch (error) {
            this.logger.error(`Failed to list Google Cloud machine types in zone ${zone}:`, error)
            throw error
        }
    }

    async listAcceleratorTypes(zone: string): Promise<protos.google.cloud.compute.v1.IAcceleratorType[]> {
        this.logger.debug(`Listing Google Cloud accelerator types in zone ${zone}`)
        try {
            const [acceleratorTypes] = await this.accelerators.list({ project: this.projectId, zone: zone })
            this.logger.debug(`List accelerator types response: ${JSON.stringify(acceleratorTypes)}`)
            return acceleratorTypes
        } catch (error) {
            this.logger.error(`Failed to list Google Cloud accelerator types in zone ${zone}:`, error)
            throw error
        }
    }

}
