import { ComputeManagementClient, VirtualMachine } from '@azure/arm-compute'
import { DefaultAzureCredential } from '@azure/identity'
import { getLogger, Logger } from '../../log/utils'
import { Subscription, SubscriptionClient } from '@azure/arm-subscriptions'
import { AzureQuotaExtensionAPI, LimitObject } from "@azure/arm-quota"

interface StartStopActionOpts {
    wait?: boolean
    waitTimeoutSeconds?: number
}

export interface AzureVMDetails {
    family: string
    subfamily?: string
    vCpuCount: number
    features?: string
}


const DEFAULT_START_STOP_OPTION_WAIT=false

// Generous default timeout as G instances are sometime long to stop
const DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT=60

/**
 * Azure API doesn't document all possible status, let's try to cover them here
 */
export enum AzureVmStatus {
    Starting = "VM starting",
    Running = "VM running",
    Deallocated = "VM deallocated", // stopped
    Deallocating = "VM deallocating", // stopping
    Unknown = "VM status unknown"
}

export class AzureClient {

    private static readonly staticLogger = getLogger(AzureClient.name)

    static async listSubscriptions(): Promise<Subscription[]>{
        const creds = new DefaultAzureCredential()
        const subsClient = new SubscriptionClient(creds)
        const subscriptions = subsClient.subscriptions.list()

        const result: Subscription[] = []
        
        for await (const sub of subscriptions) {
            result.push(sub)
        }
        return result

    }

    static async checkAuth() {
        AzureClient.staticLogger.debug("Checking Azure authentication")
        try {
            const creds = new DefaultAzureCredential()
            const token = await creds.getToken("https://management.azure.com/.default")
            AzureClient.staticLogger.debug(`Azure authentication successful: got token expiring on ${token.expiresOnTimestamp}`)
        } catch (e) {
            throw new Error(`Couldn't check Azure authentication. Did you configure your Azure credentials?`, { cause: e })
        }
    }

    private readonly computeClient: ComputeManagementClient
    private readonly logger: Logger
    private readonly credential: DefaultAzureCredential
    private readonly subsClient: SubscriptionClient
    private readonly subcriptionId: string
    private readonly quotaClient: AzureQuotaExtensionAPI
    constructor(name: string, subscriptionId: string) {
        this.logger = getLogger(name)
        this.subcriptionId = subscriptionId
        this.credential = new DefaultAzureCredential()
        this.computeClient = new ComputeManagementClient(this.credential, subscriptionId)
        this.subsClient = new SubscriptionClient(this.credential)
        this.quotaClient = new AzureQuotaExtensionAPI(this.credential)
    }

    async listInstances(): Promise<VirtualMachine[]> {
        this.logger.debug(`Listing Azure virtual machines`)

        const vms = []
        for await (const vm of this.computeClient.virtualMachines.listAll()) {
            vms.push(vm)
        }

        this.logger.trace(`List virtual machines response: ${JSON.stringify(vms)}`)

        return vms
    }

    async startInstance(resourceGroupName: string, vmName: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Starting Azure virtual machine: ${vmName}`)
            const poller = await this.computeClient.virtualMachines.beginStart(resourceGroupName, vmName)
    
            if (wait) {
                this.logger.debug(`Waiting for virtual machine ${vmName} to start`)
                await this.withTimeout(poller.pollUntilDone(), waitTimeout * 1000)
            }
        } catch (error) {
            throw new Error(`Failed to start virtual machine ${vmName}`, { cause: error })
        }
    }

    async stopInstance(resourceGroupName: string, vmName: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Stopping Azure virtual machine: ${vmName}`)
            const poller = await this.computeClient.virtualMachines.beginDeallocate(resourceGroupName, vmName)

            if (wait) {
                this.logger.debug(`Waiting for virtual machine ${vmName} to stop`)
                await this.withTimeout(poller.pollUntilDone() , waitTimeout * 1000)
            }

        } catch (error) {
            throw new Error(`Failed to stop virtual machine ${vmName}`, { cause: error })
        }
    }

    async restartInstance(resourceGroupName: string, vmName: string, opts?: StartStopActionOpts) {
        const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
        const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

        try {
            this.logger.debug(`Restarting Azure virtual machine: ${vmName}`)
            const poller = await this.computeClient.virtualMachines.beginRestart(resourceGroupName, vmName)

            if (wait) {
                this.logger.debug(`Waiting for virtual machine ${vmName} to restart`)
                await this.withTimeout(poller.pollUntilDone() , waitTimeout * 1000)
            }

        } catch (error) {
            throw new Error(`Failed to restart virtual machine ${vmName}`, { cause: error })
        }
    }

    async listLocations() {
        const locations = this.subsClient.subscriptions.listLocations(this.subcriptionId)

        const result = []
        for await (const l of locations){
            result.push(l)
        }

        return result

    }

    async listMachineSizes(location: string){

        this.logger.debug(`Listing Azure machine sizes in location: ${location}`)
        const vmSizesResp = this.computeClient.virtualMachineSizes.list(location);
        const vmSizes = []
        for await (const s of vmSizesResp){
            vmSizes.push(s)
        }

        this.logger.debug(`Found ${vmSizes.length} machine sizes in location: ${location}`)

        return vmSizes
    }

    async getComputeQuota(quotaName: string, location: string): Promise<number | undefined> {
        this.logger.debug(`Fetching compute quota ${quotaName} in location: ${location}`)

        try {
            const scope =  `subscriptions/${this.subcriptionId}/providers/Microsoft.Compute/locations/${location}`
            const quotas = await this.quotaClient.quota.get(quotaName, scope)

            this.logger.debug(`Found quota ${quotaName}: ${JSON.stringify(quotas)}`)

            // somehow not recognized as LimitObject, enforce it
            if(quotas.properties?.limit?.limitObjectType === "LimitValue"){
                const limitValue = quotas.properties?.limit as LimitObject
                return limitValue.value
            } else {
                return undefined
            }

        } catch (error) {
            throw new Error(`Failed to check quota ${quotaName} in location ${location}`, { cause: error })
        }
    }

    async getInstanceStatus(resourceGroupName: string, vmName: string): Promise<AzureVmStatus | undefined> {
        this.logger.debug(`Getting Azure virtual machine state: ${vmName}`)
        try  {
            const vm = await this.computeClient.virtualMachines.instanceView(resourceGroupName, vmName)

            const status = vm.statuses?.find(s => s.code?.startsWith("PowerState/"))?.displayStatus;

            this.logger.debug(`Found Azure virtual machine state: ${status}`)

            switch(status){
                case AzureVmStatus.Starting:
                    return AzureVmStatus.Starting
                case AzureVmStatus.Running:
                    return AzureVmStatus.Running
                case AzureVmStatus.Deallocated:
                    return AzureVmStatus.Deallocated
                case AzureVmStatus.Deallocating:
                    return AzureVmStatus.Deallocating
                default:
                    return AzureVmStatus.Unknown
            }

        } catch (error) {
            throw new Error(`Failed to get Azure virtual machine status: ${vmName}`, { cause: error })
        }
    }

    async getImage(resourceGroupName: string, imageName: string) {
        this.logger.debug(`Getting Azure image ${imageName} in resource group ${resourceGroupName}`)
        try {
            const image = await this.computeClient.images.get(resourceGroupName, imageName)
            this.logger.trace(`Get image response: ${JSON.stringify(image)}`)
            return image
        } catch (error) {
            throw new Error(`Failed to get Azure image: ${imageName}`, { cause: error })
        }
    }

    async getDisk(resourceGroupName: string, diskName: string) {
        this.logger.debug(`Getting Azure disk ${diskName} in resource group ${resourceGroupName}`)
        try {
            const disk = await this.computeClient.disks.get(resourceGroupName, diskName)
            this.logger.trace(`Get disk response: ${JSON.stringify(disk)}`)
            return disk
        } catch (error) {
            throw new Error(`Failed to get Azure disk: ${diskName}`, { cause: error })
        }
    }

    async getSnapshot(resourceGroupName: string, snapshotName: string) {
        this.logger.debug(`Getting Azure snapshot ${snapshotName} in resource group ${resourceGroupName}`)
        try {
            const snapshot = await this.computeClient.snapshots.get(resourceGroupName, snapshotName)
            this.logger.trace(`Get snapshot response: ${JSON.stringify(snapshot)}`)
            return snapshot
        } catch (error) {
            throw new Error(`Failed to get Azure snapshot: ${snapshotName}`, { cause: error })
        }
    }

    // MAY NOT BE USEFUL
    // async detachDataDisk(resourceGroupName: string, vmName: string, lun: number, opts?: StartStopActionOpts) {
    //     const wait = opts?.wait ?? DEFAULT_START_STOP_OPTION_WAIT
    //     const waitTimeout = opts?.waitTimeoutSeconds || DEFAULT_START_STOP_OPTION_WAIT_TIMEOUT

    //     try {
    //         this.logger.debug(`Detaching data disk with LUN ${lun} from virtual machine: ${vmName}`)
            
    //         // Get current VM to preserve its configuration
    //         const vm = await this.computeClient.virtualMachines.get(resourceGroupName, vmName)
            
    //         if (!vm.storageProfile?.dataDisks) {
    //             this.logger.debug(`No data disks found on VM ${vmName}, nothing to detach`)
    //             return
    //         }

    //         // Filter out the data disk with the specified LUN
    //         const updatedDataDisks = vm.storageProfile.dataDisks.filter(disk => disk.lun !== lun)
            
    //         if (updatedDataDisks.length === vm.storageProfile.dataDisks.length) {
    //             this.logger.debug(`Data disk with LUN ${lun} not found on VM ${vmName}, nothing to detach`)
    //             return
    //         }

    //         // Update VM with data disk removed
    //         const poller = await this.computeClient.virtualMachines.beginUpdate(resourceGroupName, vmName, {
    //             storageProfile: {
    //                 ...vm.storageProfile,
    //                 dataDisks: updatedDataDisks
    //             }
    //         })

    //         if (wait) {
    //             this.logger.debug(`Waiting for data disk to be detached from virtual machine ${vmName}`)
    //             await this.withTimeout(poller.pollUntilDone(), waitTimeout * 1000)
    //         }
    //     } catch (error) {
    //         throw new Error(`Failed to detach data disk from virtual machine ${vmName}`, { cause: error })
    //     }
    // }

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
