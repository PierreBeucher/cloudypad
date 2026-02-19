import { EC2Client, DescribeInstancesCommand, Instance, StartInstancesCommand, StopInstancesCommand, RebootInstancesCommand, waitUntilInstanceRunning, waitUntilInstanceStopped, DescribeInstanceTypesCommand, _InstanceType, InstanceTypeInfo, InstanceTypeOffering, DescribeInstanceTypeOfferingsCommand, DescribeInstanceStatusCommand, InstanceStateName, paginateDescribeInstances, paginateDescribeInstanceTypes, paginateDescribeInstanceTypeOfferings, DescribeImagesCommand, DescribeSnapshotsCommand, DescribeVolumesCommand, Volume, Image, DescribeAvailabilityZonesCommand } from '@aws-sdk/client-ec2'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { getLogger, Logger } from '../../log/utils'
import { loadConfig } from "@smithy/node-config-provider"
import { NODE_REGION_CONFIG_FILE_OPTIONS, NODE_REGION_CONFIG_OPTIONS } from "@smithy/config-resolver"
import { AccountClient, ListRegionsCommand } from "@aws-sdk/client-account"
import { ServiceQuotasClient, GetServiceQuotaCommand } from '@aws-sdk/client-service-quotas'

/**
 * Region to use when no client region is configured
 */
export const DEFAULT_REGION = "us-east-1"

export interface StartStopOptions {
    wait?: boolean
    waitTimeoutSeconds?: number
}

const DEFAULT_START_STOP_OPTION_WAIT=false

// Generous default timeout as G instances are sometime long to stop
const DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT=60*15

// Quote code used by AWS API
// All G and VT Spot Instance Requests
export const EC2_QUOTA_CODE_ALL_G_AND_VT_SPOT_INSTANCES = "L-3819A6DF"
// Running On-Demand G and VT instances
export const EC2_QUOTA_CODE_RUNNING_ON_DEMAND_G_AND_VT_INSTANCES = "L-DB2E81BA"

export class AwsClient {


    private static readonly staticLogger = getLogger(AwsClient.name)
    
    /**
     * Return currently set region (as identified by AWS SDK).
     * @returns currently configured region - undefined if not region currently set
     */
    static async getCurrentRegion(): Promise<string | undefined> {
        // AWS SDK V3 does not provide an easy way to get current region
        // Use this method taken from https://github.com/aws/aws-sdk-js-v3/discussions/4488
        try {
            return await loadConfig(NODE_REGION_CONFIG_OPTIONS, NODE_REGION_CONFIG_FILE_OPTIONS)()
        } catch (e){
            AwsClient.staticLogger.debug("Couldn't fin AWS region: ", e)
            return undefined
        }
    }

    static async listRegions(): Promise<string[]>{
        // listRegions() may be called with no configured region
        // Use a default region in such scenario
        const region = await AwsClient.getCurrentRegion() ?? DEFAULT_REGION
        const accountClient = new AccountClient({ region: region })
        return AwsClient.listRegionWithPage(accountClient)
    }

    private static async listRegionWithPage(accountClient: AccountClient, nextToken?: string): Promise<string[]>{

        const command = new ListRegionsCommand({ NextToken: nextToken})
        const result = await accountClient.send(command)

        const regions = result.Regions?.filter(r => r.RegionName).map(r => r.RegionName!) ?? []
        
        if(result.NextToken){
            return regions.concat(await this.listRegionWithPage(accountClient, result.NextToken))
        } else {
            return regions
        }
    }

    private readonly ec2Client: EC2Client
    private readonly stsClient: STSClient
    private readonly logger: Logger
    private readonly region: string
    private readonly quotaClient: ServiceQuotasClient

    constructor(name: string, region: string){
        this.logger = getLogger(name)

        // Region must be explicitely set as most operation require a region which may not be set by default
        // Client code should prompt specify region in such case
        this.region = region
        this.ec2Client = new EC2Client({ region: this.region })
        this.stsClient = new STSClient({ region: this.region })
        this.quotaClient = new ServiceQuotasClient({ region })
    }

    async checkAuth() {
        this.logger.debug("Checking AWS authentication")
        try {
            const callerIdentity = await this.stsClient.send(new GetCallerIdentityCommand({}))
            this.logger.debug(`Currently authenticated as ${callerIdentity.UserId} on account ${callerIdentity.Account}`)
        } catch (e) {
            throw new Error(`Couldn't check AWS authentication. Did you configure your AWS credentials ?`, { cause: e })
        }
    }

    async listAvailabilityZones(): Promise<string[]> {
        this.logger.debug(`Listing availability zones in region ${this.region}`)
        try {
            const command = new DescribeAvailabilityZonesCommand({
                Filters: [
                    {
                        Name: 'state',
                        Values: ['available']
                    }
                ]
            })
            const result = await this.ec2Client.send(command)
            const zones = result.AvailabilityZones?.map(az => az.ZoneName).filter((zoneName): zoneName is string => zoneName !== undefined) ?? []
            this.logger.debug(`Found ${zones.length} availability zones in region ${this.region}`)
            return zones.sort()
        } catch (e) {
            throw new Error(`Failed to list availability zones in region ${this.region}`, { cause: e })
        }
    }

    async listInstances(): Promise<Instance[]>{

        this.logger.debug(`Listing AWS instances`)

        const paginator = paginateDescribeInstances({ client: this.ec2Client }, {})
        
        let instances: Instance[] = []
        for await (const page of paginator) {
            instances = instances.concat(page.Reservations?.flatMap(reservation => reservation.Instances).filter(instance => instance !== undefined) || [])
        }

        this.logger.trace(`Described instances, found: ${JSON.stringify(instances)}`)
        
        return instances
    }

    async startInstance(instanceId: string, opts?: StartStopOptions) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            const command = new StartInstancesCommand({
                InstanceIds: [instanceId],
            })
    
            this.logger.debug(`Starting AWS instance: ${JSON.stringify(command)}`)
    
            const result = await this.ec2Client.send(command)
            
            this.logger.trace(`Starting EC2 instance response ${JSON.stringify(result)}`)
    
            if (wait) {
                this.logger.debug(`Waiting for instance ${instanceId} to reach 'running' state`)
                await waitUntilInstanceRunning(
                    { client: this.ec2Client, maxWaitTime: waitTimeout  },
                    { InstanceIds: [instanceId] }
                )
                this.logger.trace(`Instance ${instanceId} is now running`)
            }
        } catch (error) {
            throw new Error(`Failed to start EC2 instance ${instanceId}`, { cause: error })
        }
    }

    async stopInstance(instanceId: string, opts?: StartStopOptions) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            const command = new StopInstancesCommand({
                InstanceIds: [instanceId],
            })
    
            this.logger.debug(`Stopping instance: ${JSON.stringify(command)}`)
    
            const result = await this.ec2Client.send(command)
    
            this.logger.trace(`Stopping EC2 instance response ${JSON.stringify(result)}`)
    
            if (wait) {
                this.logger.debug(`Waiting for instance ${instanceId} to reach 'stopped' state`)
                await waitUntilInstanceStopped(
                    { client: this.ec2Client, maxWaitTime: waitTimeout },
                    { InstanceIds: [instanceId] }
                )
                this.logger.trace(`Instance ${instanceId} is now stopped`)
            }
        } catch (error) {
            throw new Error(`Failed to stop EC2 instance ${instanceId}`, { cause: error })
        }
    }
    
    async restartInstance(instanceId: string, opts?: StartStopOptions) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            const rebootCommand = new RebootInstancesCommand({
                InstanceIds: [instanceId],
            })
    
            this.logger.debug(`Restarting instance: ${JSON.stringify(rebootCommand)}`)
    
            const result = await this.ec2Client.send(rebootCommand)
            
            this.logger.trace(`Restarting EC2 instance response ${JSON.stringify(result)}`)
    
            if (wait) {
                this.logger.debug(`Waiting for instance ${instanceId} to reach 'running' state after reboot`)
                await waitUntilInstanceRunning(
                    { client: this.ec2Client, maxWaitTime: waitTimeout },
                    { InstanceIds: [instanceId] }
                )
                this.logger.trace(`Instance ${instanceId} is now fully restarted and running`)
            }
        } catch (error) {
            throw new Error(`Failed to restart EC2 instance ${instanceId}`, { cause: error })
        }
    }

    async getInstanceState(instanceId: string): Promise<InstanceStateName | undefined> {
        this.logger.debug(`Describing instance status for ${instanceId}`)
        
        try {
            const command = new DescribeInstanceStatusCommand({
                InstanceIds: [instanceId],
                IncludeAllInstances: true,
            })
            const response = await this.ec2Client.send(command)
            
            this.logger.debug(`Instance status response: ${JSON.stringify(response)}`)

            if(!response.InstanceStatuses || response.InstanceStatuses.length === 0) {
                throw new Error(`Instance not found (or AWS API returned an empty response): '${instanceId}'`)
            }

            const state = response.InstanceStatuses[0].InstanceState?.Name

            this.logger.debug(`Found instance ${instanceId} status: ${state}`)
            
            return state
        } catch (error) {
            throw new Error(`Failed to get instance ${instanceId} status`, { cause: error })
        }
    }

    /**
     * Get quota value for a given quota code
     * @param quotaCode quota code to check
     * @returns quota value if available, undefined if not
     */
    async getQuota(quotaCode: string): Promise<number | undefined> {
        
        try {
            this.logger.debug(`Checking quota code ${quotaCode} in region: ${this.region}`)
            
            const command = new GetServiceQuotaCommand({
                ServiceCode: 'ec2',
                QuotaCode: quotaCode,
            })

            const response = await this.quotaClient.send(command)
            this.logger.trace(`Service Quota Response: ${JSON.stringify(response)}`)
            
            return response.Quota?.Value
        } catch (error) {
            throw new Error(`Failed to check quota code ${quotaCode} in region ${this.region}`, { cause: error })
        }
    }

    /**
     * Fetch instance type details from AWS (vCPU, memory...)
     * @param instanceTypes instance types to fetch details for
     * @returns instance type details
     */
    async getInstanceTypeDetails(instanceTypes: string[]): Promise<InstanceTypeInfo[]> {
        
        this.logger.debug(`Fetching instance type details for ${JSON.stringify(instanceTypes)} in region ${this.region}`)

        try {
            const internalInstanceTypes = stringsToInstanceTypes(instanceTypes)
            let foundInstanceTypes: InstanceTypeInfo[] = [];
            
            const paginator = paginateDescribeInstanceTypes({ client: this.ec2Client }, { Filters: [{ Name: "instance-type", Values: internalInstanceTypes }] })
            for await (const page of paginator) {
                foundInstanceTypes.push(...(page.InstanceTypes || []))
            }

            this.logger.debug(`Instance type details: ${JSON.stringify(foundInstanceTypes.map(type => type.InstanceType))})`)
            
            if (foundInstanceTypes.length > 0) {
                return foundInstanceTypes
            } else {
                throw new Error(`No instance type details found for ${JSON.stringify(instanceTypes)} in region ${this.region}`)
            }

        } catch (error) {
            throw new Error(`Failed to fetch instance details for instance type ${JSON.stringify(instanceTypes)} in region ${this.region}`, { cause: error })
        }
    }

    /**
     * Filter instance types that are available in client's region
     * @param instanceTypes instance types to filter
     * @returns instance types available in client's region
     */
    async filterAvailableInstanceTypes(instanceTypes: string[]): Promise<string[]> {

        this.logger.debug(`Filtering available instance types for ${JSON.stringify(instanceTypes)} in region ${this.region}`)
        try {
            const internalInstanceTypes = stringsToInstanceTypes(instanceTypes)
            
            let offerings: InstanceTypeOffering[] = [];    
            const paginator = paginateDescribeInstanceTypeOfferings({ client: this.ec2Client }, {
                LocationType: "region",
                Filters: [
                    {
                        Name: "instance-type",
                        Values: internalInstanceTypes,
                    },
                ],
            });

            for await (const page of paginator) {
                offerings = offerings.concat(page.InstanceTypeOfferings || []);
            }

            this.logger.debug(`Instance type offerings response: ${JSON.stringify(offerings.map(offering => offering.InstanceType))})`)
            
            return offerings
                .filter(offering => offering.Location === this.region && offering.InstanceType)
                .map(offering => String(offering.InstanceType))

        } catch (error) {
            throw new Error(`Failed to check availability of instance type ${instanceTypes} in region ${this.region}`, { cause: error })
        }
    }

    /**
     * Check if an AMI (image) exists
     * @param imageId AMI ID to check
     * @returns true if AMI exists, false otherwise
     */
    async checkAmiExists(imageId: string): Promise<boolean> {
        this.logger.debug(`Checking if AMI ${imageId} exists`)
        try {
            const command = new DescribeImagesCommand({
                ImageIds: [imageId],
            })
            const response = await this.ec2Client.send(command)
            return response.Images !== undefined && response.Images.length > 0
        } catch (error) {
            this.logger.debug(`Error checking AMI ${imageId}: ${error}`)
            return false
        }
    }

    /**
     * Check if an EBS snapshot exists
     * @param snapshotId Snapshot ID to check
     * @returns true if snapshot exists, false otherwise
     */
    async checkSnapshotExists(snapshotId: string): Promise<boolean> {
        this.logger.debug(`Checking if snapshot ${snapshotId} exists`)
        try {
            const command = new DescribeSnapshotsCommand({
                SnapshotIds: [snapshotId],
            })
            const response = await this.ec2Client.send(command)
            return response.Snapshots !== undefined && response.Snapshots.length > 0
        } catch (error) {
            this.logger.debug(`Error checking snapshot ${snapshotId}: ${error}`)
            return false
        }
    }

    /**
     * Get an EBS volume by volume ID
     * @param volumeId Volume ID to get
     * @returns Volume if exists, null otherwise
     */
    async getVolume(volumeId: string): Promise<Volume | null> {
        this.logger.debug(`Getting volume ${volumeId}`)
        try {
            const command = new DescribeVolumesCommand({
                VolumeIds: [volumeId],
            })
            const response = await this.ec2Client.send(command)
            if (response.Volumes && response.Volumes.length > 0) {
                return response.Volumes[0]
            }
            return null
        } catch (error: any) {
            if (error?.name === 'InvalidVolume.NotFound') {
                return null
            }
            throw new Error(`Failed to get volume ${volumeId}`, { cause: error })
        }
    }

    /**
     * Get an AMI (image) by image ID
     * @param imageId AMI ID to get
     * @returns Image if exists, null otherwise
     */
    async getImage(imageId: string): Promise<Image | null> {
        this.logger.debug(`Getting image ${imageId}`)
        try {
            const command = new DescribeImagesCommand({
                ImageIds: [imageId],
            })
            const response = await this.ec2Client.send(command)
            if (response.Images && response.Images.length > 0) {
                return response.Images[0]
            }
            return null
        } catch (error: any) {
            if (error?.name === 'InvalidAMIID.NotFound') {
                return null
            }
            throw new Error(`Failed to get image ${imageId}`, { cause: error })
        }
    }

}

/**
 * Convert instance type strings to AWS SDK internal instance type object
 * @param instanceTypes instance type strings
 * @returns internal instance type objects
 */
export function stringsToInstanceTypes(instanceTypes: string[]): _InstanceType[] {
    const result: _InstanceType[] = []
    for(const instanceType of instanceTypes) {
        if(Object.values(_InstanceType).includes(instanceType as _InstanceType)) {
            result.push(instanceType as _InstanceType)
        } else {
            throw new Error(`Invalid instance type '${instanceType}', not recognized by AWS SDK`)
        }
    }
    return result
}
