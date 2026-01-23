import { ScalewayInstanceInput, ScalewayStateParser, ScalewayInstanceStateV1, ScalewayProvisionInputV1 } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { input, select } from '@inquirer/prompts';
import { AbstractInputPrompter, PromptOptions } from "../../cli/prompter";
import { ScalewayClient } from "./sdk-client";
import { CLOUDYPAD_PROVIDER_SCALEWAY } from "../../core/const";
import { PartialDeep } from "type-fest";
import { CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_DISK_SIZE, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_OPTIONS, CLI_OPTION_DATA_DISK_SIZE, CLI_OPTION_ROOT_DISK_SIZE, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP, CLI_OPTION_RATE_LIMIT_MAX_MBPS, CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS, CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE, CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE } from "../../cli/command";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { ScalewayProviderClient } from "./provider";

export interface ScalewayCreateCliArgs extends CreateCliArgs {
    projectId?: string
    region?: string
    zone?: string
    instanceType?: string
    rootDiskSize?: number
    imageId?: string
    dataDiskSize?: number
    deleteInstanceServerOnStop?: boolean
    dataDiskSnapshotEnable?: boolean
    baseImageSnapshotEnable?: boolean
}

export type ScalewayUpdateCliArgs = UpdateCliArgs & Omit<ScalewayCreateCliArgs, "projectId" | "zone" | "region" | "volumeType" >

export class ScalewayInputPrompter extends AbstractInputPrompter<ScalewayCreateCliArgs, ScalewayProvisionInputV1, CommonConfigurationInputV1> {
    
    protected buildProvisionerInputFromCliArgs(cliArgs: ScalewayCreateCliArgs): PartialDeep<ScalewayInstanceInput> {

        return {
            provision: {
                region: cliArgs.region,
                zone: cliArgs.zone,
                projectId: cliArgs.projectId,
                instanceType: cliArgs.instanceType,
                diskSizeGb: cliArgs.rootDiskSize,
                imageId: cliArgs.imageId,
                dataDiskSizeGb: cliArgs.dataDiskSize,
                deleteInstanceServerOnStop: cliArgs.deleteInstanceServerOnStop,
                dataDiskSnapshot: cliArgs.dataDiskSnapshotEnable ? { 
                    enable: cliArgs.dataDiskSnapshotEnable 
                } : undefined,
                baseImageSnapshot: cliArgs.baseImageSnapshotEnable ? { 
                    enable: cliArgs.baseImageSnapshotEnable 
                } : undefined
            }
        }
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<ScalewayInstanceInput>, createOptions: PromptOptions): Promise<ScalewayInstanceInput> {
        
        if(!createOptions.autoApprove && !createOptions.skipQuotaWarning){
            await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_SCALEWAY, "https://docs.cloudypad.gg/cloud-provider-setup/scaleway.html")
        }

        ScalewayClient.checkLocalConfig()

        const defaulScwClient = new ScalewayClient(ScalewayInputPrompter.name, {})

        const projectId = await this.projectId(defaulScwClient, partialInput.provision?.projectId)
        const region = await this.region(defaulScwClient, partialInput.provision?.region)
        const zone = await this.zone(defaulScwClient, region, partialInput.provision?.zone)

        // subsequent inputs can use selected zone and region
        const zonalScwClient = new ScalewayClient(ScalewayInputPrompter.name, {
            region: region,
            zone: zone
        })

        const instanceType = await this.instanceType(zonalScwClient, partialInput.provision?.instanceType)
        const rootDiskSizeGb = await this.rootDiskSize(partialInput.provision?.diskSizeGb)
        const dataDiskSizeGb = await this.dataDiskSize(partialInput.provision?.dataDiskSizeGb)

        const scwInput: ScalewayInstanceInput = {
            configuration: commonInput.configuration,
            instanceName: commonInput.instanceName,
            provision: {
                ssh: commonInput.provision.ssh,
                region: region,
                projectId: projectId,
                zone: zone,
                instanceType: instanceType,
                diskSizeGb: rootDiskSizeGb,
                dataDiskSizeGb: dataDiskSizeGb,
                imageId: partialInput.provision?.imageId,
                deleteInstanceServerOnStop: partialInput.provision?.deleteInstanceServerOnStop,
                dataDiskSnapshot: partialInput.provision?.dataDiskSnapshot?.enable ? { 
                    enable: partialInput.provision.dataDiskSnapshot.enable 
                } : undefined,
                baseImageSnapshot: partialInput.provision?.baseImageSnapshot?.enable ? { 
                    enable: partialInput.provision.baseImageSnapshot.enable 
                } : undefined
            }
        }
        
        return scwInput
        
    }

    private async instanceType(client: ScalewayClient, instanceType?: string): Promise<string> {
        if (instanceType) {
            return instanceType
        }

        const sizes = await client.listGpuInstanceTypes(1) // only show instance with 1 GPU by default   

        const choices = sizes
            .sort((a, b) => a.cpu - b.cpu)
            .map(s => ({ name: `${s.name} (${s.cpu} CPU, ${s.ramGb} GB RAM, ${s.gpu} GPU)`, value: s.name }))

        if(choices.length == 0){
            console.warn("⚠️ No GPU instance type found in selected region and zone. You may want to use another region or zone.")
        }

        choices.push({ name: "Let me type an instance type", value: "_" })

        let selectedType = await select({
            message: 'Instance type:',
            choices: choices,
            loop: false
        })

        if(selectedType === "_"){
            selectedType = await input({
                message: 'Type an instance type:',
            })
        }

        return selectedType
    }

    private async rootDiskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize
        }

        // If not overridden, use a static default value$
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

    private async region(client: ScalewayClient, region?: string): Promise<string> {
        if (region) {
            return region
        }

        const locs = ScalewayClient.listRegions()

        const choices = locs.map(l => ({ name: l, value: l})).sort()

        return await select({
            message: 'Region:',
            choices: choices,
            loop: false
        })
    }

    private async zone(client: ScalewayClient, region: string, zone?: string): Promise<string> {
        if (zone) {
            return zone
        }

        const locs = ScalewayClient.listZones()

        const choices = locs
            .filter(l => l.startsWith(region))
            .map(l => ({ name: l, value: l})).sort()

        return await select({
            message: 'Zone:',
            choices: choices,
            loop: false
        })
    }

    private async projectId(client: ScalewayClient, projId?: string): Promise<string> {

        if (projId) {
            return projId;
        }

        const projs = await client.listProjects()

        // No prompt if a single project is available
        if(projs.length == 1){
            return projs[0].id
        }

        const choices = projs.filter(s => s.id !== undefined)
            .map(s => ({ name: `${s.name} (${s.id})`, value: s.id}))

        return await select({
            message: 'Project:',
            choices: choices,
            loop: false
        })
    }
}

export class ScalewayCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_SCALEWAY)
            .addOption(CLI_OPTION_ROOT_DISK_SIZE)
            .addOption(CLI_OPTION_DATA_DISK_SIZE)
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
            .addOption(CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP)
            .addOption(CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE)
            .addOption(CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE)
            .option('--region <region>', 'Region in which to deploy instance')
            .option('--zone <zone>', 'Zone in which to deploy instance')
            .option('--project-id <projectid>', 'Project ID in which to deploy resources')
            .option('--instance-type <instance-type>', 'Instance type')
            .option('--image-id <image-id>', 'Existing image ID for instance server. Disk size must be equal or greater than image size.')
            .action(async (cliArgs: ScalewayCreateCliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_SCALEWAY })

                try {
                    const scalewayProviderClient = new ScalewayProviderClient({ config: args.coreConfig })
                    const scalewayInstanceInitializer = new InteractiveInstanceInitializer<ScalewayInstanceStateV1, ScalewayCreateCliArgs>({
                        providerClient: scalewayProviderClient,
                        inputPrompter: new ScalewayInputPrompter({ coreConfig: args.coreConfig }),
                        initArgs: cliArgs
                    })

                    await scalewayInstanceInitializer.initializeInteractive()
                    
                    
                } catch (error) {   
                    throw new Error('Scaleway instance initilization failed', { cause: error })
                }
            })
    }

    buildUpdateCommand(args: BuildUpdateCommandArgs) {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_SCALEWAY)
            .addOption(CLI_OPTION_ROOT_DISK_SIZE)
            .addOption(CLI_OPTION_DATA_DISK_SIZE)
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
            .addOption(CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP)
            .option('--instance-type <instance-type>', 'Instance type')
            .option('--image-id <image-id>', 'Existing image ID for instance server. Disk size must be equal or greater than image size.')
            .action(async (cliArgs: ScalewayUpdateCliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_SCALEWAY })

                try {
                    await new InteractiveInstanceUpdater<ScalewayInstanceStateV1, ScalewayUpdateCliArgs>({
                        providerClient: new ScalewayProviderClient({ config: args.coreConfig }),
                        inputPrompter: new ScalewayInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Scaleway instance update failed', { cause: error })
                }
            })
    }
}