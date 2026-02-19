import { AzureInstanceInput, AzureStateParser, AzureInstanceStateV1, AZURE_SUPPORTED_DISK_TYPES, AzureProvisionInputV1 } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { input, select, confirm } from '@inquirer/prompts';
import { AbstractInputPrompter, costAlertCliArgsIntoConfig, PromptOptions } from "../../cli/prompter";
import { AzureClient } from "./sdk-client";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_AZURE, PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const";
import { PartialDeep } from "type-fest";
import { CreateCliArgsSchema, CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_DISK_SIZE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, UpdateCliArgsSchema, CLI_OPTION_KEYBOARD_OPTIONS, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_USE_LOCALE, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_RATE_LIMIT_MAX_MBPS, CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS, CLI_OPTION_DATA_DISK_SIZE, CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE, CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE, CLI_OPTION_KEEP_BASE_IMAGE_ON_DELETION, CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP } from "../../cli/command";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { AzureProviderClient } from "./provider";
import { z } from "zod";

/**
 * Zod schema for Azure-specific CLI arguments.
 * Extends the generic CreateCliArgsSchema with Azure-specific options.
 * This schema matches what Commander.js produces from CLI flags.
 */
export const AzureCreateCliArgsSchema = CreateCliArgsSchema.extend({
    subscriptionId: z.string().optional(),
    resourceGroupName: z.string().optional(),
    location: z.string().optional(),
    vmSize: z.string().optional(),
    diskSize: z.number().optional(),
    diskType: z.string().optional(),
    spot: z.boolean().optional(),
    costAlert: z.boolean().optional(),
    costLimit: z.number().optional(),
    costNotificationEmail: z.string().optional(),
    dataDiskSize: z.number().optional(),
    deleteInstanceServerOnStop: z.boolean().optional(),
    dataDiskSnapshot: z.boolean().optional(),
    baseImageSnapshot: z.boolean().optional(),
    baseImageKeepOnDeletion: z.boolean().optional(),
})

/**
 * Azure-specific CLI arguments for create command.
 * Type is inferred from Zod schema to ensure consistency.
 */
export type AzureCreateCliArgs = z.infer<typeof AzureCreateCliArgsSchema>

/**
 * Zod schema for Azure-specific update CLI arguments.
 */
export const AzureUpdateCliArgsSchema = UpdateCliArgsSchema.extend({ 
    vmSize: z.string().optional(),
    diskSize: z.number().optional(),
    costAlert: z.boolean().optional(),
    costLimit: z.number().optional(),
    costNotificationEmail: z.string().optional(),
    dataDiskSize: z.number().optional(),
    baseImageKeepOnDeletion: z.boolean().optional(),
})

/**
 * Azure-specific CLI arguments for update command.
 * Type is inferred from Zod schema to ensure consistency.
 */
export type AzureUpdateCliArgs = z.infer<typeof AzureUpdateCliArgsSchema>



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

    // AMD GPU, not supported yet
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
    
    // Still not supported despite datacenter drivers
    // Would need Azure GRID drivers
    // See https://learn.microsoft.com/en-us/azure/virtual-machines/linux/n-series-driver-setup
    // { machineType: "Standard_NV6ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family" },
    // { machineType: "Standard_NV12ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    // { machineType: "Standard_NV18ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    // { machineType: "Standard_NV36adms_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    // { machineType: "Standard_NV36ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
    // { machineType: "Standard_NV72ads_A10_v5", gpuType: "NVIDIA", gpuName: "A10", quotaName: "StandardNVADSA10v5Family"},
]

export class AzureInputPrompter extends AbstractInputPrompter<AzureCreateCliArgs, AzureProvisionInputV1, CommonConfigurationInputV1> {
    
    protected buildProvisionerInputFromCliArgs(cliArgs: AzureCreateCliArgs): PartialDeep<AzureInstanceInput> {

        return {
            provision: {
                vmSize: cliArgs.vmSize,
                diskSize: cliArgs.diskSize,
                dataDiskSizeGb: cliArgs.dataDiskSize,
                diskType: cliArgs.diskType,
                location: cliArgs.location,
                subscriptionId: cliArgs.subscriptionId,
                useSpot: cliArgs.spot,
                costAlert: costAlertCliArgsIntoConfig(cliArgs),
                deleteInstanceServerOnStop: cliArgs.deleteInstanceServerOnStop,
                dataDiskSnapshot: cliArgs.dataDiskSnapshot ? { 
                    enable: cliArgs.dataDiskSnapshot 
                } : undefined,
                baseImageSnapshot: cliArgs.baseImageSnapshot ? { 
                    enable: cliArgs.baseImageSnapshot,
                    keepOnDeletion: cliArgs.baseImageKeepOnDeletion
                } : undefined
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
                    dataDiskSizeGb: partialInput.provision?.dataDiskSizeGb ?? 0, // Use CLI arg if provided, otherwise default to 0
                    diskType: diskType,
                    vmSize: vmSize,
                    publicIpType: publicIpType,
                    location: location,
                    subscriptionId: subscriptionId,
                    useSpot: useSpot,
                    costAlert: costAlert,
                    deleteInstanceServerOnStop: partialInput.provision?.deleteInstanceServerOnStop,
                    dataDiskSnapshot: partialInput.provision?.dataDiskSnapshot,
                    baseImageSnapshot: partialInput.provision?.baseImageSnapshot,
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
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_AZURE)
            .addOption(CLI_OPTION_SPOT)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_DATA_DISK_SIZE)
            .addOption(CLI_OPTION_COST_ALERT)
            .addOption(CLI_OPTION_COST_LIMIT)
            .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
            .addOption(CLI_OPTION_STREAMING_SERVER)
            .addOption(CLI_OPTION_SUNSHINE_USERNAME)
            .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
            .addOption(CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS)
            .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
            .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
            .addOption(CLI_OPTION_USE_LOCALE)
            .addOption(CLI_OPTION_KEYBOARD_LAYOUT)
            .addOption(CLI_OPTION_KEYBOARD_MODEL)
            .addOption(CLI_OPTION_KEYBOARD_VARIANT)
            .addOption(CLI_OPTION_KEYBOARD_OPTIONS)
            .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
            .addOption(CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE)
            .addOption(CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE)
            .addOption(CLI_OPTION_KEEP_BASE_IMAGE_ON_DELETION)
            .addOption(CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP)
            .option('--vm-size <vmsize>', 'Virtual machine size')
            .option('--location <location>', 'Location in which to deploy instance')
            .option('--subscription-id <subscriptionid>', 'Subscription ID in which to deploy resources')
            .option('--disk-type <disktype>', `Disk type. One of ${Object.values(AZURE_SUPPORTED_DISK_TYPES).join(', ')}`)
            .action(async (rawCliArgs: unknown) => {
                // Parse raw CLI args using Zod schema early to ensure type safety
                const cliArgs = AzureCreateCliArgsSchema.parse(rawCliArgs)
                
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_AZURE })

                try {
                    await new InteractiveInstanceInitializer<AzureInstanceStateV1, AzureCreateCliArgs>({ 
                        providerClient: new AzureProviderClient({ config: args.coreConfig }),
                        inputPrompter: new AzureInputPrompter({ coreConfig: args.coreConfig }),
                        initArgs: cliArgs
                    }).initializeInteractive()
                    
                } catch (error) {   
                    throw new Error('Azure instance initilization failed', { cause: error })
                }
            })
    }

    buildUpdateCommand(args: BuildUpdateCommandArgs) {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_AZURE)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_COST_ALERT)
            .addOption(CLI_OPTION_COST_LIMIT)
            .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
            .addOption(CLI_OPTION_SUNSHINE_USERNAME)
            .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
            .addOption(CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS)
            .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
            .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
            .addOption(CLI_OPTION_USE_LOCALE)
            .addOption(CLI_OPTION_KEYBOARD_LAYOUT)
            .addOption(CLI_OPTION_KEYBOARD_MODEL)
            .addOption(CLI_OPTION_KEYBOARD_VARIANT)
            .addOption(CLI_OPTION_KEYBOARD_OPTIONS)
            .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
            .option('--vm-size <vmsize>', 'Virtual machine size')
            .action(async (rawCliArgs: unknown) => {
                // Parse raw CLI args using Zod schema early to ensure type safety
                const cliArgs = AzureUpdateCliArgsSchema.parse(rawCliArgs)
                
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_AZURE })

                try {
                    await new InteractiveInstanceUpdater<AzureInstanceStateV1, AzureUpdateCliArgs>({
                        providerClient: new AzureProviderClient({ config: args.coreConfig }),
                        inputPrompter: new AzureInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Azure instance update failed', { cause: error })
                }
            })
    }
}