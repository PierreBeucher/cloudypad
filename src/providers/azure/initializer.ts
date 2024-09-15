import { input, select } from '@inquirer/prompts'
import { PartialDeep } from 'type-fest'
import { InstanceInitializer, GenericInitializationArgs, StaticInitializerPrompts } from '../../core/initializer'
import { StateManager } from '../../core/state'
import { getLogger } from '../../log/utils'
import { InstanceProvisionOptions } from '../../core/provisioner'
import { AzureProvisioner } from './provisioner'
import { AzureInstanceRunner } from './runner'
import { AzureClient } from '../../tools/azure'

export interface AzureProvisionArgs {
    create: {
        vmSize: string
        diskSize: number
        publicIpType: string
        subscriptionId: string
        location: string
        useSpot: boolean
    }
}

export class AzureInstanceInitializer extends InstanceInitializer {

    private readonly defaultAzureArgs: PartialDeep<AzureProvisionArgs>

    constructor(genericArgs?: PartialDeep<Omit<GenericInitializationArgs, "provider">>, defaultAzureArgs?: PartialDeep<AzureProvisionArgs>){
        super(genericArgs)
        this.defaultAzureArgs = defaultAzureArgs ?? {}
    }

    protected async runProvisioning(sm: StateManager, opts: InstanceProvisionOptions) {
        const args = await new AzureInitializerPrompt().prompt(this.defaultAzureArgs)

        this.logger.debug(`Running Azure provision with args: ${JSON.stringify(args)}`)
        
        sm.update({ 
            ssh: {
                user: "ubuntu"
            },
            provider: { azure: { provisionArgs: args }}
        })

        await new AzureProvisioner(sm).provision(opts)
    }

    protected async runPairing(sm: StateManager) {
        await new AzureInstanceRunner(sm).pair()
    }
    
}

export class AzureInitializerPrompt {

    private logger = getLogger(AzureInitializerPrompt.name)


    async prompt(args?: PartialDeep<AzureProvisionArgs>): Promise<AzureProvisionArgs> {

        this.logger.debug(`Starting Azure prompt with default opts: ${JSON.stringify(args)}`)

        const subscriptionId = await this.subscriptionId(args?.create?.subscriptionId)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(args?.create?.useSpot)
        const location = await this.location(subscriptionId, args?.create?.location)
        const vmSize = await this.instanceType(subscriptionId, location, args?.create?.vmSize)
        const diskSize = await this.diskSize(args?.create?.diskSize)
        const publicIpType = await this.publicIpType(args?.create?.publicIpType)

        return {
            create: {
                diskSize: diskSize,
                vmSize: vmSize,
                publicIpType: publicIpType,
                location: location,
                subscriptionId: subscriptionId,
                useSpot: useSpot,
            }
        }
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
