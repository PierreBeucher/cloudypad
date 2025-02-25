import { AzureInstanceInput, AzureStateParser, AzureInstanceStateV1, AZURE_SUPPORTED_DISK_TYPES } from "./state"
import { CommonInstanceInput } from "../../core/state/state"
import { input, select, confirm } from '@inquirer/prompts';
import { AbstractInputPrompter, costAlertCliArgsIntoConfig, PromptOptions } from "../../cli/prompter";
import { AzureClient } from "../../tools/azure";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_AZURE, PUBLIC_IP_TYPE } from "../../core/const";
import { PartialDeep } from "type-fest";
import { CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, CreateCliArgs, UpdateCliArgs } from "../../cli/command";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InstanceUpdater } from "../../cli/updater";

export interface AzureCreateCliArgs extends CreateCliArgs {
    subscriptionId?: string
    resourceGroupName?: string
    location?: string
    vmSize?: string
    diskSize?: number
    diskType?: string
    publicIpType?: PUBLIC_IP_TYPE
    spot?: boolean,
    costAlert?: boolean,
    costLimit?: number,
    costNotificationEmail?: string
}

export type AzureUpdateCliArgs = UpdateCliArgs & Omit<AzureCreateCliArgs, "subscriptionId" | "resourceGroupName" | "location" | "diskType" >


export const AZURE_SUPPORTED_GPU = [
    { machineType: "Standard_NC4as_T4_v3", gpuType: "NVIDIA", gpuName: "Tesla T4", quotaName: "Standard NCASv3_T4 Family" },
    { machineType: "Standard_NC8as_T4_v3", gpuType: "NVIDIA", gpuName: "Tesla T4", quotaName: "Standard NCASv3_T4 Family" },
    { machineType: "Standard_NC16as_T4_v3", gpuType: "NVIDIA", gpuName: "Tesla T4", quotaName: "Standard NCASv3_T4 Family" },
    { machineType: "Standard_NC64as_T4_v3", gpuType: "NVIDIA", gpuName: "Tesla T4", quotaName: "Standard NCASv3_T4 Family" },

    { machineType: "Standard_NC6s_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNCSv3Family" },
    { machineType: "Standard_NC12s_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNCSv3Family" },
    { machineType: "Standard_NC24rs_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNCSv3Family" },
    { machineType: "Standard_NC24s_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNCSv3Family" },
    

    { machineType: "Standard_NC24ads_A100_v4", gpuType: "NVIDIA", gpuName: "A100", quotaName: "standardNCADSA100v4Family" },
    { machineType: "Standard_NC48ads_A100_v4", gpuType: "NVIDIA", gpuName: "A100", quotaName: "standardNCADSA100v4Family" },
    { machineType: "Standard_NC96ads_A100_v4", gpuType: "NVIDIA", gpuName: "A100", quotaName: "standardNCADSA100v4Family" },

    // { machineType: "Standard_NV4as_v4", gpuType: "AMD", gpuName: "Radeon MI25" },
    // { machineType: "Standard_NV8as_v4", gpuType: "AMD", gpuName: "Radeon MI25" },
    // { machineType: "Standard_NV16as_v4", gpuType: "AMD", gpuName: "Radeon MI25" },
    // { machineType: "Standard_NV32as_v4", gpuType: "AMD", gpuName: "Radeon MI25" },
    { machineType: "Standard_NV6s_v2", gpuType: "NVIDIA", gpuName: "Tesla P40", quotaName: "standardNVSv2Family" },
    { machineType: "Standard_NV12s_v2", gpuType: "NVIDIA", gpuName: "Tesla P40", quotaName: "standardNVSv2Family" },
    { machineType: "Standard_NV24s_v2", gpuType: "NVIDIA", gpuName: "Tesla P40", quotaName: "standardNVSv2Family" },

    { machineType: "Standard_NV12s_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNVSv3Family" },
    { machineType: "Standard_NV24s_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNVSv3Family" },
    { machineType: "Standard_NV48s_v3", gpuType: "NVIDIA", gpuName: "Tesla V100", quotaName: "standardNVSv3Family" },
    
    { machineType: "Standard_NV6ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family" },
    { machineType: "Standard_NV12ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    { machineType: "Standard_NV18ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    { machineType: "Standard_NV36adms_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    { machineType: "Standard_NV36ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    { machineType: "Standard_NV72ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
]

export class AzureInputPrompter extends AbstractInputPrompter<AzureCreateCliArgs, AzureInstanceInput> {
    
    protected buildProvisionerInputFromCliArgs(cliArgs: AzureCreateCliArgs): PartialDeep<AzureInstanceInput> {

        return {
            provision: {
                vmSize: cliArgs.vmSize,
                diskSize: cliArgs.diskSize,
                diskType: cliArgs.diskType, 
                publicIpType: cliArgs.publicIpType,
                location: cliArgs.location,
                subscriptionId: cliArgs.subscriptionId,
                useSpot: cliArgs.spot,
                costAlert: costAlertCliArgsIntoConfig(cliArgs)
            }
        }
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<AzureInstanceInput>, createOptions: PromptOptions): Promise<AzureInstanceInput> {
        
        if(!createOptions.autoApprove && !createOptions.skipQuotaWarning){
            await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_AZURE, "https://docs.cloudypad.gg/cloud-provider-setup/azure.html")
        }

        const subscriptionId = await this.subscriptionId(partialInput.provision?.subscriptionId)
        const useSpot = await this.useSpotInstance(partialInput.provision?.useSpot)
        const location = await this.location(subscriptionId, partialInput.provision?.location)
        const vmSize = await this.instanceType(subscriptionId, location, useSpot,partialInput.provision?.vmSize)
        const diskType = await this.diskType(partialInput.provision?.diskType)
        const diskSize = await this.diskSize(partialInput.provision?.diskSize)
        const publicIpType = await this.publicIpType(partialInput.provision?.publicIpType)
        const costAlert = await this.costAlert(partialInput.provision?.costAlert)
        
        const azInput: AzureInstanceInput = lodash.merge(
            {},
            commonInput,
            {
                provision: {
                    diskSize: diskSize,
                    diskType: diskType,
                    vmSize: vmSize,
                    publicIpType: publicIpType,
                    location: location,
                    subscriptionId: subscriptionId,
                    useSpot: useSpot,
                    costAlert: costAlert,
                },
            })
        
        return azInput
        
    }

    private async instanceType(subscriptionId: string, location: string, useSpot: boolean, instanceType?: string): Promise<string> {
        if (instanceType) {
            return instanceType
        }

        const client = new AzureClient(AzureInputPrompter.name, subscriptionId)
        const allMachineSize = await client.listMachineSizes(location)

        const supportedMachineTypes = AZURE_SUPPORTED_GPU.map(t => t.machineType)

        // List all machine types in current location
        // And correlate with supported GPU types to show both size and GPU type
        const vmSizes = allMachineSize.filter((machineSize) => {
            return machineSize.name && supportedMachineTypes.indexOf(machineSize.name) > -1
        })

        const choices = vmSizes.filter(s => s.name !== undefined)
            .sort((a, b) => {
                // sort by cpu size
                const cpuA = a.numberOfCores ?? 0
                const cpuB = b.numberOfCores ?? 0
                return cpuA - cpuB  
            })
            .map(s => ({ name: 
                    `${s.name} (vCPUs: ${s.numberOfCores ?? 'unknown'},` +
                    `RAM: ${s.memoryInMB ? s.memoryInMB / 1024 : 'unknown'} GiB, ` +
                    `GPU: NVIDIA ${AZURE_SUPPORTED_GPU.find(t => t.machineType === s.name)?.gpuName ?? 'unknown'})`, 
                value: s.name!}))
            
        choices.push({name: "Let me type an instance type", value: "_"})

        const selectedInstanceType = await select({
            message: 'Choose a VM size (sorted by vCPU count):',
            choices: choices,
            loop: false
        })

        if(selectedInstanceType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        // Check quota for selected instance type
        const supportedGpuType = AZURE_SUPPORTED_GPU.find(supported => supported.machineType == selectedInstanceType)
        const selectedInstanceTypeDetails = allMachineSize.find(m => m.name === selectedInstanceType)
        if(supportedGpuType !== undefined && selectedInstanceTypeDetails !== undefined && selectedInstanceTypeDetails.numberOfCores !== undefined) {
            const currentQuota = await client.getComputeQuota(supportedGpuType.quotaName, location)
            
            this.logger.debug(`Quota for ${selectedInstanceType}: limit ${currentQuota}, instance require ${selectedInstanceTypeDetails.numberOfCores} cores`)

            if(currentQuota !== undefined && currentQuota < selectedInstanceTypeDetails.numberOfCores) {
                const confirmQuota = await confirm({
                    message: `Uh oh. It seems quotas for machine type ${selectedInstanceType} in region ${location} may be too low. \n`+
                    `You can still try to provision the instance, but it may fail. \n` +
                    `Current limit: ${currentQuota}\n\n` +
                    `Checkout https://docs.cloudypad.gg/cloud-provider-setup/azure.html for details about quotas.\n\n` +
                    `Do you still want to continue?`,
                    default: false,
                })
    
                if(!confirmQuota){
                    throw new Error(`Stopped instance creation: detected quota were not high enough for ${selectedInstanceType} in ${location}`)
                }
            } else {
                this.logger.debug(`Detected sufficient quota for ${selectedInstanceType}: current limit ${currentQuota} for ${selectedInstanceTypeDetails.numberOfCores} cores`)
            }
        } else {
            this.logger.warn(`Couldn't check quota for instance type ${instanceType}. You may have to set quota manually.` + 
                `See https://docs.cloudypad.gg/cloud-provider-setup/aws.html for details.`)
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

    private async diskType(diskType?: string): Promise<string> {
        if (diskType) {
            return diskType
        }

        const choices = [
            { name: "Standard HDD (cheap but slow)", value: "Standard_LRS" },
            { name: "Standard SSD (faster, a bit more expensive)", value: "StandardSSD_LRS" },
            { name: "Premium SSD (fastest, most expensive)", value: "Premium_LRS" },
        ]

        const selectedDiskType = await select({
            message: 'Enter desired disk type ',
            choices: choices,
        })

        return selectedDiskType

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
            .addOption(CLI_OPTION_COST_ALERT)
            .addOption(CLI_OPTION_COST_LIMIT)
            .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
            .addOption(CLI_OPTION_STREAMING_SERVER)
            .addOption(CLI_OPTION_SUNSHINE_USERNAME)
            .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
            .option('--vm-size <vmsize>', 'Virtual machine size')
            .option('--location <location>', 'Location in which to deploy instance')
            .option('--subscription-id <subscriptionid>', 'Subscription ID in which to deploy resources')
            .option('--disk-type <disktype>', `Disk type. One of ${Object.values(AZURE_SUPPORTED_DISK_TYPES).join(', ')}`)
            .action(async (cliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_AZURE })

                try {
                    await new InteractiveInstanceInitializer<AzureCreateCliArgs>({ 
                        inputPrompter: new AzureInputPrompter(),
                        provider: CLOUDYPAD_PROVIDER_AZURE,
                    }).initializeInstance(cliArgs)
                    
                } catch (error) {
                    throw new Error('Azure instance initilization failed', { cause: error })
                }
            })
    }

    buildUpdateCommand() {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_AZURE)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .addOption(CLI_OPTION_COST_ALERT)
            .addOption(CLI_OPTION_COST_LIMIT)
            .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
            .addOption(CLI_OPTION_SUNSHINE_USERNAME)
            .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
            .option('--vm-size <vmsize>', 'Virtual machine size')
            .action(async (cliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_AZURE })

                try {
                    await new InstanceUpdater<AzureInstanceStateV1, AzureUpdateCliArgs>({
                        stateParser: new AzureStateParser(),
                        inputPrompter: new AzureInputPrompter()
                    }).update(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Azure instance update failed', { cause: error })
                }
            })
    }
}