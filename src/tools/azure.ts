import { ComputeManagementClient, VirtualMachine } from '@azure/arm-compute'
import { DefaultAzureCredential } from '@azure/identity'
import { getLogger, Logger } from '../log/utils'
import { Subscription, SubscriptionClient } from '@azure/arm-subscriptions'

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
            AzureClient.staticLogger.error(`Couldn't check Azure authentication: ${JSON.stringify(e)}`)
            AzureClient.staticLogger.error(`Is your local Azure authentication configured?`)
            throw new Error(`Couldn't check Azure authentication: ${JSON.stringify(e)}`)
        }
    }

    private readonly computeClient: ComputeManagementClient
    private readonly logger: Logger
    private readonly credential: DefaultAzureCredential
    private readonly subsClient: SubscriptionClient
    private readonly subcriptionId: string

    constructor(name: string, subscriptionId: string) {
        this.logger = getLogger(name)
        this.subcriptionId = subscriptionId
        this.credential = new DefaultAzureCredential()
        this.computeClient = new ComputeManagementClient(this.credential, subscriptionId)
        this.subsClient = new SubscriptionClient(this.credential)
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

    async startInstance(resourceGroupName: string, vmName: string) {
        try {
            this.logger.debug(`Starting Azure virtual machine: ${vmName}`)
            const result = await this.computeClient.virtualMachines.beginStartAndWait(resourceGroupName, vmName)
            this.logger.trace(`Starting virtual machine response ${JSON.stringify(result)}`)
        } catch (error) {
            this.logger.error(`Failed to start virtual machine ${vmName}:`, error)
            throw error
        }
    }

    async stopInstance(resourceGroupName: string, vmName: string) {
        try {
            this.logger.debug(`Stopping Azure virtual machine: ${vmName}`)
            const result = await this.computeClient.virtualMachines.beginDeallocateAndWait(resourceGroupName, vmName)
            this.logger.trace(`Stopping virtual machine response ${JSON.stringify(result)}`)
        } catch (error) {
            this.logger.error(`Failed to stop virtual machine ${vmName}:`, error)
            throw error
        }
    }

    async restartInstance(resourceGroupName: string, vmName: string) {
        try {
            this.logger.debug(`Restarting Azure virtual machine: ${vmName}`)
            const result = await this.computeClient.virtualMachines.beginRestartAndWait(resourceGroupName, vmName)
            this.logger.trace(`Restarting virtual machine response ${JSON.stringify(result)}`)
        } catch (error) {
            this.logger.error(`Failed to restart virtual machine ${vmName}:`, error)
            throw error
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

        const vmSizesResp = this.computeClient.virtualMachineSizes.list(location);
        const vmSizes = []
        for await (const s of vmSizesResp){
            vmSizes.push(s)
        }

        return vmSizes
    }
}
