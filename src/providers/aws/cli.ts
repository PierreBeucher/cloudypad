import { AwsInstanceInput, AwsInstanceStateV1, AwsProvisionInputV1, AwsStateParser } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { input, select, confirm } from '@inquirer/prompts';
import { AwsClient, EC2_QUOTA_CODE_ALL_G_AND_VT_SPOT_INSTANCES, EC2_QUOTA_CODE_RUNNING_ON_DEMAND_G_AND_VT_INSTANCES, DEFAULT_REGION } from "./sdk-client";
import { AbstractInputPrompter, AbstractInputPrompterArgs, costAlertCliArgsIntoConfig, PromptOptions } from "../../cli/prompter";
import lodash from 'lodash'
import { CreateCliArgsSchema, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CliCommandGenerator, UpdateCliArgsSchema, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_KEYBOARD_OPTIONS, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_USE_LOCALE, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_RATE_LIMIT_MAX_MBPS, CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS, CLI_OPTION_ROOT_DISK_SIZE, CLI_OPTION_DATA_DISK_SIZE, CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE, CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE, CLI_OPTION_KEEP_BASE_IMAGE_ON_DELETION, CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP } from "../../cli/command";
import { CLOUDYPAD_PROVIDER_AWS, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../../core/const";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { PartialDeep } from "type-fest";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { cleanupAndExit, handleErrorAnalytics, logFullError } from "../../cli/program";
import { AwsProviderClient } from "./provider";
import { z } from "zod";

/**
 * Zod schema for AWS-specific CLI arguments.
 * Extends the generic CreateCliArgsSchema with AWS-specific options.
 * This schema matches what Commander.js produces from CLI flags.
 */
export const AwsCreateCliArgsSchema = CreateCliArgsSchema.extend({
    spot: z.boolean().optional(),
    diskSize: z.number().optional(),
    rootDiskSize: z.number().optional(),
    dataDiskSize: z.number().optional(),
    publicIpType: z.enum([PUBLIC_IP_TYPE_STATIC, PUBLIC_IP_TYPE_DYNAMIC]).optional(),
    instanceType: z.string().optional(),
    region: z.string().optional(),
    costAlert: z.boolean().optional(),
    costLimit: z.number().optional(),
    costNotificationEmail: z.string().optional(),
    imageId: z.string().optional(), 
    baseImageSnapshot: z.boolean().optional(),
    baseImageKeepOnDeletion: z.boolean().optional(),
    dataDiskSnapshot: z.boolean().optional(),
    deleteInstanceServerOnStop: z.boolean().optional(),
})

/**
 * AWS-specific CLI arguments for create command.
 * Type is inferred from Zod schema to ensure consistency.
 */
export type AwsCreateCliArgs = z.infer<typeof AwsCreateCliArgsSchema>

/**
 * Zod schema for AWS-specific update CLI arguments.
 */
export const AwsUpdateCliArgsSchema = UpdateCliArgsSchema.extend({
    diskSize: z.number().optional(),
    rootDiskSize: z.number().optional(),
    dataDiskSize: z.number().optional(),
    instanceType: z.string().optional(),
    costAlert: z.boolean().optional(),
    costLimit: z.number().optional(),
    costNotificationEmail: z.string().optional(),
    imageId: z.string().optional(), 
    baseImageKeepOnDeletion: z.boolean().optional(),
})

/**
 * Possible update arguments for AWS update.
 * Type is inferred from Zod schema to ensure consistency.
 */
export type AwsUpdateCliArgs = z.infer<typeof AwsUpdateCliArgsSchema>

/**
 * Supported instance types for AWS. Other instance types may work but are not tested.
 * Bigger instances (eg. 16x large or metal) should work but are overkill for most users, not listing them by default.
 */
export const SUPPORTED_INSTANCE_TYPES = [
    "g4dn.xlarge", "g4dn.2xlarge", "g4dn.4xlarge",
    "g5.xlarge", "g5.2xlarge", "g5.4xlarge", "g5.8xlarge"
]

export class AwsInputPrompter extends AbstractInputPrompter<AwsCreateCliArgs, AwsProvisionInputV1, CommonConfigurationInputV1> {

    constructor(args: AbstractInputPrompterArgs){
        super(args)
    }

    buildProvisionerInputFromCliArgs(cliArgs: AwsCreateCliArgs): PartialDeep<AwsInstanceInput> {

        return {
            provision: {
                instanceType: cliArgs.instanceType,
                diskSize: cliArgs.rootDiskSize ?? cliArgs.diskSize, // diskSize and rootDiskSize are aliases for the same thing
                dataDiskSizeGb: cliArgs.dataDiskSize,
                publicIpType: cliArgs.publicIpType,
                region: cliArgs.region,
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

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<AwsInstanceInput>, createOptions: PromptOptions): Promise<AwsInstanceInput> {

        if(!createOptions.autoApprove && !createOptions.skipQuotaWarning){
            await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_AWS, "https://docs.cloudypad.gg/cloud-provider-setup/aws.html")
        }

        const region = await this.region(partialInput.provision?.region)
        const useSpot = await this.useSpotInstance(partialInput.provision?.useSpot)
        const instanceType = await this.instanceType(region, useSpot, partialInput.provision?.instanceType)
        const rootDiskSize = await this.rootDiskSize(partialInput.provision?.diskSize)
        const dataDiskSizeGb = await this.dataDiskSize(partialInput.provision?.dataDiskSizeGb)
        const publicIpType = await this.publicIpType(partialInput.provision?.publicIpType)
        const costAlert = await this.costAlert(partialInput.provision?.costAlert)
                
        const awsInput: AwsInstanceInput = lodash.merge(
            {},
            commonInput, 
            {
                provision:{
                    diskSize: rootDiskSize,
                    dataDiskSizeGb: dataDiskSizeGb,
                    instanceType: instanceType,
                    publicIpType: publicIpType,
                    region: region,
                    useSpot: useSpot,
                    costAlert: costAlert,
                    deleteInstanceServerOnStop: partialInput.provision?.deleteInstanceServerOnStop,
                    dataDiskSnapshot: partialInput.provision?.dataDiskSnapshot?.enable ? { 
                        enable: partialInput.provision.dataDiskSnapshot.enable 
                    } : undefined,
                    baseImageSnapshot: partialInput.provision?.baseImageSnapshot?.enable ? { 
                        enable: partialInput.provision.baseImageSnapshot.enable,
                        keepOnDeletion: partialInput.provision.baseImageSnapshot.keepOnDeletion
                    } : undefined
                }
            })
        
        return awsInput
        
    }

    private async instanceType(region: string, useSpot: boolean, instanceType?: string): Promise<string> {

        if (instanceType) {
            return instanceType;
        }

        // fetch AWS instance type details
        const awsClient = new AwsClient("instance-type-prompt", region)
        const availableInstanceTypes = await awsClient.filterAvailableInstanceTypes(SUPPORTED_INSTANCE_TYPES)
        const instanceTypeDetails = await awsClient.getInstanceTypeDetails(availableInstanceTypes)

        const choices = instanceTypeDetails
            .filter(typeInfo => typeInfo.InstanceType)
            .sort((a, b) => {
                // Sort by vCPU count
                const aVCpu = a.VCpuInfo?.DefaultVCpus || 0;
                const bVCpu = b.VCpuInfo?.DefaultVCpus || 0;
                return aVCpu - bVCpu;
            })
            .map(typeInfo => {
                const instanceType = typeInfo.InstanceType! // guaranteed to exist with filter
                const memoryGb = typeInfo.MemoryInfo?.SizeInMiB ? typeInfo.MemoryInfo?.SizeInMiB / 1024 : undefined
                return {
                    name: `${instanceType} - ${typeInfo.VCpuInfo?.DefaultVCpus} vCPU - ${memoryGb} GiB Memory`,
                    value: String(instanceType),
                }
            })

        choices.push({name: "Let me type an instance type", value: "_"})

        const selectedInstanceType = await select({
            message: 'Choose an instance type:',
            default: "g4dn.xlarge",
            choices: choices,
            loop: false,
        })

        if(selectedInstanceType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        // Check quotas for select instance type
        // Depending on spot usage, quota is different
        const quotaCode = useSpot ? EC2_QUOTA_CODE_ALL_G_AND_VT_SPOT_INSTANCES : EC2_QUOTA_CODE_RUNNING_ON_DEMAND_G_AND_VT_INSTANCES
        const currentQuota = await awsClient.getQuota(quotaCode)
        
        const selectInstanceTypeDetails = instanceTypeDetails.find(typeInfo => typeInfo.InstanceType === selectedInstanceType)

        if(currentQuota === undefined || selectInstanceTypeDetails === undefined || selectInstanceTypeDetails.VCpuInfo?.DefaultVCpus === undefined){
            this.logger.warn(`No quota found for machine type ${JSON.stringify(selectInstanceTypeDetails)} in region ${region}`)
            this.logger.warn(`Unable to check for quota before creating instance ${selectedInstanceType} in ${region}. Instance creation may fail.` + 
                `See https://docs.cloudypad.gg/cloud-provider-setup/aws.html for details about quotas`)

        } else if (currentQuota < selectInstanceTypeDetails.VCpuInfo?.DefaultVCpus) {
            this.logger.debug(`Quota found for machine type ${JSON.stringify(selectInstanceTypeDetails)} in region ${region}: ${currentQuota}`)

            const confirmQuota = await confirm({
                message: `Uh oh. It seems quotas for machine type ${selectedInstanceType} in region ${region} may be too low. \n` +
                `You can still try to provision the instance, but it may fail.\n\n` +
                `Current quota: ${currentQuota} vCPUS\n` +
                `Required quota: ${selectInstanceTypeDetails.VCpuInfo?.DefaultVCpus} vCPUs\n\n` +
                `Checkout https://docs.cloudypad.gg/cloud-provider-setup/aws.html for details about quotas.\n\n` +
                `Do you still want to continue?`,
                default: false,
            })

            if(!confirmQuota){
                throw new Error(`Stopped instance creation: detected quota were not high enough for ${selectedInstanceType} in ${region}`)
            }
        }

        return selectedInstanceType        
    }

    private async rootDiskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize;
        }

        // If not overridden, use a static default value
        // As OS disk size is managed by Cloudy Pad and should not impact user 
        // except for specific customizations
        return 20
    }

    private async dataDiskSize(diskSize?: number): Promise<number> {
        if (diskSize !== undefined) { // allow 0 meaning explicit no data disk
            return diskSize
        }

        let selectedDiskSize: string
        let parsedDiskSize: number | undefined = undefined

        while (parsedDiskSize === undefined || isNaN(parsedDiskSize)) {
            selectedDiskSize = await input({
                message: 'Data disk size in GB (OS will use another independent disk)',
                default: "100"
            })
            parsedDiskSize = Number.parseInt(selectedDiskSize)
        }

        return parsedDiskSize
    }

    private async region(region?: string): Promise<string> {
        if (region) {
            return region;
        }

        const currentAwsRegion = await AwsClient.getCurrentRegion()
        const regions = await AwsClient.listRegions()

        return await select({
            message: 'Select an AWS region to deploy instance:',
            choices: regions.map(r => ({
                name: r,
                value: r,
            })),
            loop: false,
            default: currentAwsRegion,
        })
    }
}

export class AwsCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_AWS)
            .addOption(CLI_OPTION_SPOT)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_ROOT_DISK_SIZE)
            .addOption(CLI_OPTION_DATA_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
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
            .option('--instance-type <type>', 'EC2 instance type')
            .option('--region <region>', 'Region in which to deploy instance')
            .option('--image-id <image-id>', 'Existing AMI ID for instance server. Disk size must be equal or greater than image size.')
            .action(async (rawCliArgs: unknown) => {
                // Parse raw CLI args using Zod schema early to ensure type safety
                const cliArgs = AwsCreateCliArgsSchema.parse(rawCliArgs)
                
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_AWS })
                
                try {
                    await new InteractiveInstanceInitializer<AwsInstanceStateV1, AwsCreateCliArgs>({ 
                        providerClient: new AwsProviderClient({ config: args.coreConfig }),
                        inputPrompter: new AwsInputPrompter({ coreConfig: args.coreConfig }),
                        initArgs: cliArgs
                    }).initializeInteractive()
                    
                } catch (error) {
                    logFullError(error)
                
                    console.error("")
                    console.error("Oops, something went wrong 😨 Full error is shown above.")
                    console.error("")
                    console.error("If you think this is a bug, please file an issue with full error: https://github.com/PierreBeucher/cloudypad/issues")
                    console.error("")
                    console.error("⚠️ Your instance was not created successfully. To cleanup resources and avoid leaving orphaned resources which may be charged, run:")
                    console.error("")
                    console.error("    cloudypad destroy <instance-name>")

                    handleErrorAnalytics(error)
                    await cleanupAndExit(1)
                }
            })
    }

    buildUpdateCommand(args: BuildUpdateCommandArgs) {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_AWS)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_ROOT_DISK_SIZE)
            .addOption(CLI_OPTION_DATA_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
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
            .addOption(CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE)
            .addOption(CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE)
            .addOption(CLI_OPTION_KEEP_BASE_IMAGE_ON_DELETION)
            .addOption(CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP)
            .option('--instance-type <type>', 'EC2 instance type')
            .action(async (rawCliArgs: unknown) => {
                // Parse raw CLI args using Zod schema early to ensure type safety
                const cliArgs = AwsUpdateCliArgsSchema.parse(rawCliArgs)
                
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_AWS })
                
                try {
                    await new InteractiveInstanceUpdater<AwsInstanceStateV1, AwsUpdateCliArgs>({
                        providerClient: new AwsProviderClient({ config: args.coreConfig }),
                        inputPrompter: new AwsInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Instance update failed', { cause: error })
                }
            })
    }
}