import { input, select } from '@inquirer/prompts'
import { InstanceInitializer, StaticInitializerPrompts, InstanceInitArgs } from '../../core/initializer'
import { AzureClient } from '../../tools/azure'
import { AzureInstanceStateV1, AzureProvisionConfigV1, AzureProvisionOutputV1 } from './state'
import { InstanceManager } from '../../core/manager'
import { AzureInstanceManager } from './manager'
import { CommonProvisionConfigV1 } from '../../core/state/state'
import { CLOUDYPAD_PROVIDER_AZURE } from '../../core/const'


export type AzureInstanceInitArgs = InstanceInitArgs<AzureProvisionConfigV1>

export class AzureInstanceInitializer extends InstanceInitializer<AzureProvisionConfigV1, AzureProvisionOutputV1> {

    constructor(args: AzureInstanceInitArgs){
        super(CLOUDYPAD_PROVIDER_AZURE, args)
    }

    protected async buildInstanceManager(state: AzureInstanceStateV1): Promise<InstanceManager> {
        return new AzureInstanceManager(state)
    }

    async promptProviderConfig(commonConfig: CommonProvisionConfigV1): Promise<AzureProvisionConfigV1> {
        this.logger.debug(`Starting Azure prompt with default opts: ${JSON.stringify(commonConfig)}`)

        const subscriptionId = await this.subscriptionId(this.args.config.subscriptionId)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(this.args.config.useSpot)
        const location = await this.location(subscriptionId, this.args.config.location)
        const vmSize = await this.instanceType(subscriptionId, location, this.args.config.vmSize)
        const diskSize = await this.diskSize(this.args.config.diskSize)
        const publicIpType = await this.publicIpType(this.args.config.publicIpType)

        const azConf: AzureProvisionConfigV1 = {
            ...commonConfig,
            diskSize: diskSize,
            vmSize: vmSize,
            publicIpType: publicIpType,
            location: location,
            subscriptionId: subscriptionId,
            useSpot: useSpot,
        }

        return azConf
    }

    private async instanceType(subscriptionId: string, location: string, instanceType?: string): Promise<string> {
        if (instanceType) {
            return instanceType
        }

        const client = new AzureClient(AzureInstanceInitializer.name, subscriptionId)
        const allMachineSize = await client.listMachineSizes(location)

        // Only include NVIDIA GPU suitable for gaming
        // Skip  NV v4 (AMD GPU not supported yet)
        const gpuSizes = allMachineSize.filter((size) => 
            (size.name?.includes("Standard_NC") || size.name?.includes("Standard_NV"))
            && !size.name!.match("Standard_NV.*_v4")
        )

        // Leave choices to reasonable instances (between 4 and 16 vCPUs)
        // and let user enter a specific type if needed
        const choices = gpuSizes.filter(s => s.name)
            .filter(s => s.numberOfCores && s.numberOfCores >= 4 && s.numberOfCores <= 16)
            .map(s => ({ name: `${s.name}(vCPUs: ${s.numberOfCores}, RAM: ${s.memoryInMB}MB)`, value: s.name!}))
            .sort((a, b) => {
                // name is set as per above filter
                const nameA = a.name!
                const nameB = b.name!
            
                // Split the VM size names into components
                const partsA = nameA.split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/)
                const partsB = nameB.split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/)
            
                for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
                    const partA = partsA[i];
                    const partB = partsB[i];
            
                    // Compare numbers
                    const numA = parseInt(partA, 10)
                    const numB = parseInt(partB, 10)
                    if (!isNaN(numA) && !isNaN(numB)) {
                        if (numA !== numB) return numA - numB;
                    } else {
                        // Compare strings
                        if (partA !== partB) return partA.localeCompare(partB)
                    }
                }
            
                // If all compared parts are equal, the shorter name should come first
                return partsA.length - partsB.length;
            })

        choices.push({name: "Let me type an instance type", value: "_"})

        const selectedInstanceType = await select({
            message: 'Choose a VM size:',
            choices: choices,
            loop: false
        })

        if(selectedInstanceType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        return selectedInstanceType        
    }

    private async diskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize
        }

        const selectedDiskSize = await input({
            message: 'Enter desired disk size (GB):',
            default: "100"
        })

        return Number.parseInt(selectedDiskSize)

    }

    private async publicIpType(publicIpType?: string): Promise<string> {
        if (publicIpType) {
            return publicIpType
        }

        const publicIpTypeChoices = ['static', 'dynamic'].map(type => ({
            name: type,
            value: type,
        }))

        return await select({
            message: 'Use static Elastic IP or dynamic IP? :',
            choices: publicIpTypeChoices,
            default: 'static',
        })
    }

    private async location(subscriptionId: string, location?: string): Promise<string> {
        if (location) {
            return location
        }

        const client = new AzureClient(AzureInstanceInitializer.name, subscriptionId)
        const locs = await client.listLocations()

        const choices = locs.filter(l => l.name && l.displayName)
            .map(l => ({ name: `${l.displayName} (${l.name})`, value: l.name!}))
            .sort()

        return await select({
            message: 'Enter Azure location to use:',
            choices: choices
        })
    }

    async resourceGroupName(rgName?: string): Promise<string> {
        if (rgName) {
            this.logger.debug(`Using provided resource group name: ${rgName}`)
            return rgName;
        } else {

            return await input({
                message: 'Enter Azure resource group name to use:',
            })
        }
    }

    async subscriptionId(subId?: string): Promise<string> {

        if (subId) {
            this.logger.debug(`Using provided subscription ID: ${subId}`)
            return subId;
        } else {

            const subs = await AzureClient.listSubscriptions()

            const choices = subs.filter(s => s.subscriptionId !== undefined)
                .map(s => ({ name: `${s.displayName} (${s.subscriptionId!})`, value: s.subscriptionId!}))
    
            return await select({
                message: 'Enter Azure subscription ID to use:',
                choices: choices
            })
        }
    }
}