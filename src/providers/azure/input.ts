import { AzureInstanceInput } from "./state"
import { CommonInstanceInput } from "../../core/state/state"
import { input, select } from '@inquirer/prompts';
import { AbstractInputPrompter } from "../../core/input/prompter";
import { AzureClient } from "../../tools/azure";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_AZURE, PUBLIC_IP_TYPE } from "../../core/const";
import { PartialDeep } from "type-fest";
import { CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CliCommandGenerator, CreateCliArgs } from "../../core/input/cli";
import { InteractiveInstanceInitializer } from "../../core/initializer";
import { InstanceManagerBuilder } from "../../core/manager-builder";

export interface AzureCreateCliArgs extends CreateCliArgs {
    subscriptionId?: string
    resourceGroupName?: string
    location?: string
    vmSize?: string
    diskSize?: number
    publicIpType?: PUBLIC_IP_TYPE
    spot?: boolean
}

export class AzureInputPrompter extends AbstractInputPrompter<AzureCreateCliArgs, AzureInstanceInput> {
    
    protected doTransformCliArgsIntoInput(cliArgs: AzureCreateCliArgs): PartialDeep<AzureInstanceInput> {
        return {
            instanceName: cliArgs.name,
            provision: {
                ssh: {
                    privateKeyPath: cliArgs.privateSshKey
                },
                vmSize: cliArgs.vmSize,
                diskSize: cliArgs.diskSize,
                publicIpType: cliArgs.publicIpType,
                location: cliArgs.location,
                subscriptionId: cliArgs.subscriptionId,
                useSpot: cliArgs.spot,
            },
            configuration: {}
        }
    }

    protected async promptSpecificInput(defaultInput: CommonInstanceInput & PartialDeep<AzureInstanceInput>): Promise<AzureInstanceInput> {

        this.logger.debug(`Starting Azure prompt with default opts: ${JSON.stringify(defaultInput)}`)
        
        const subscriptionId = await this.subscriptionId(defaultInput.provision?.subscriptionId)
        const useSpot = await this.useSpotInstance(defaultInput.provision?.useSpot)
        const location = await this.location(subscriptionId, defaultInput.provision?.location)
        const vmSize = await this.instanceType(subscriptionId, location, defaultInput.provision?.vmSize)
        const diskSize = await this.diskSize(defaultInput.provision?.diskSize)
        const publicIpType = await this.publicIpType(defaultInput.provision?.publicIpType)

        const azInput: AzureInstanceInput = lodash.merge(
            {},
            defaultInput,
            {
                provision: {
                    diskSize: diskSize,
                    vmSize: vmSize,
                    publicIpType: publicIpType,
                    location: location,
                    subscriptionId: subscriptionId,
                    useSpot: useSpot,
                },
            })
        
        return azInput
        
    }

    private async instanceType(subscriptionId: string, location: string, instanceType?: string): Promise<string> {
        if (instanceType) {
            return instanceType
        }

        const client = new AzureClient(AzureInputPrompter.name, subscriptionId)
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

    private async location(subscriptionId: string, location?: string): Promise<string> {
        if (location) {
            return location
        }

        const client = new AzureClient(AzureInputPrompter.name, subscriptionId)
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

export class AzureCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand() {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_AZURE)
            .addOption(CLI_OPTION_SPOT)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .option('--vm-size <vmsize>', 'Virtual machine size')
            .option('--location <location>', 'Location in which to deploy instance')
            .option('--subscription-id <subscriptionid>', 'Subscription ID in which to deploy resources')
            .action(async (cliArgs) => {
                try {
                    await new InteractiveInstanceInitializer({ 
                        inputPrompter: new AzureInputPrompter(),
                        provider: CLOUDYPAD_PROVIDER_AZURE,
                    }).initializeInstance(cliArgs)
                    
                } catch (error) {
                    console.error('Error creating Azure instance:', error)
                    process.exit(1)
                }
            })
    }

    buildUpdateCommand() {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_AZURE)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .option('--vm-size <vmsize>', 'Virtual machine size')
            .action(async (cliArgs) => {
                try {
                    const input = new AzureInputPrompter().cliArgsIntoInput(cliArgs)
                    const updater = await new InstanceManagerBuilder().buildAzureInstanceUpdater(cliArgs.name)
                    await updater.update({
                        provisionInput: input.provision,
                        configurationInput: input.configuration,
                    }, { 
                        autoApprove: cliArgs.yes
                    })
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    console.error('Error updating Azure instance:', error)
                    process.exit(1)
                }
            })
    }
}