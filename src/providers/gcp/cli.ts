import { GcpInstanceInput, GcpInstanceStateV1, GcpStateParser } from "./state"
import { CommonInstanceInput } from "../../core/state/state"
import { input, select } from '@inquirer/prompts';
import { AbstractInputPrompter, costAlertCliArgsIntoConfig, PromptOptions } from "../../core/cli/prompter";
import { GcpClient } from "../../tools/gcp";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE } from "../../core/const";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceInitializer } from "../../core/initializer";
import { CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CliCommandGenerator, CreateCliArgs, UpdateCliArgs } from "../../core/cli/command";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InstanceUpdater } from "../../core/updater";

export interface GcpCreateCliArgs extends CreateCliArgs {
    projectId?: string
    region?: string
    zone?: string
    machineType?: string
    diskSize?: number
    publicIpType?: PUBLIC_IP_TYPE
    gpuType?: string
    spot?: boolean,
    costAlert?: boolean
    costLimit?: number
    costNotificationEmail?: string
}

/**
 * Possible update arguments for GCP update. Use create arguments as reference and remove fields that cannot be updated.
 */
export type GcpUpdateCliArgs = UpdateCliArgs & Omit<GcpCreateCliArgs, "projectId" | "region" | "zone">

export class GcpInputPrompter extends AbstractInputPrompter<GcpCreateCliArgs, GcpInstanceInput> {
    
    protected buildProvisionerInputFromCliArgs(cliArgs: GcpCreateCliArgs): PartialDeep<GcpInstanceInput> {
        return {
            provision:{ 
                machineType: cliArgs.machineType,
                diskSize: cliArgs.diskSize,
                publicIpType: cliArgs.publicIpType,
                region: cliArgs.region,
                zone: cliArgs.zone,
                acceleratorType: cliArgs.gpuType,
                projectId: cliArgs.projectId,
                useSpot: cliArgs.spot,
                costAlert: costAlertCliArgsIntoConfig(cliArgs),
            },
        }
    }

    protected async promptSpecificInput(defaultInput: CommonInstanceInput & PartialDeep<GcpInstanceInput>, createOptions: PromptOptions): Promise<GcpInstanceInput> {

        this.logger.debug(`Starting Gcp prompt with defaultInput: ${JSON.stringify(defaultInput)} and createOptions: ${JSON.stringify(createOptions)}`)

        if(!createOptions.autoApprove && !createOptions.skipQuotaWarning){
            await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_GCP, "https://cloudypad.gg/cloud-provider-setup/gcp.html")
        }
        
        const projectId = await this.project(defaultInput.provision?.projectId)
        
        const client = new GcpClient(GcpInputPrompter.name, projectId)

        const region = await this.region(client, defaultInput.provision?.region)
        const zone = await this.zone(client, region, defaultInput.provision?.zone)
        const machineType = await this.machineType(client, zone, defaultInput.provision?.machineType)
        const acceleratorType = await this.acceleratorType(client, zone, defaultInput.provision?.acceleratorType)
        const useSpot = await this.useSpotInstance(defaultInput.provision?.useSpot)
        const diskSize = await this.diskSize(defaultInput.provision?.diskSize)
        const publicIpType = await this.publicIpType(defaultInput.provision?.publicIpType)
        const costAlert = await this.costAlert(defaultInput.provision?.costAlert)
        
        const gcpInput: GcpInstanceInput = lodash.merge(
            {},
            defaultInput,
            {
                provision: {
                    projectId: projectId,
                    diskSize: diskSize,
                    machineType: machineType,
                    publicIpType: publicIpType,
                    region: region,
                    zone: zone,
                    acceleratorType: acceleratorType,
                    useSpot: useSpot,
                    costAlert: costAlert,
                },
            }
        )

        return gcpInput   
    }

    private async machineType(client: GcpClient, zone: string, machineType?: string): Promise<string> {
        if (machineType) {
            return machineType
        }

        const machineTypes = await client.listMachineTypes(zone)

        const choices = machineTypes
            .filter(t => t.name)
            .filter(t => t.name && t.name.startsWith("n1") // Only show n1 with reasonable specs
                && t.guestCpus && t.guestCpus >= 2 && t.guestCpus <=16
                && t.memoryMb && t.memoryMb >= 1000 && t.memoryMb <= 100000
            ) 
            .sort((a, b) => { // Sort by CPU/RAM count
                if (a.guestCpus === b.guestCpus) {
                    return a.memoryMb! - b.memoryMb!; // Sort by memory if CPU count is the same
                }
                return a.guestCpus! - b.guestCpus!
            }) 
            .map(t => ({
                name: `${t.name} (CPUs: ${t.guestCpus}, RAM: ${Math.round(t.memoryMb! / 100)/10} GiB)`,
                value: t.name!,
            }))
        
        if(choices.length == 0){
            this.logger.warn("No suitable N1 machine type available in selected zone. It's recommended to use N1 instance type with Google Cloud. You can still choose your own instance type but setup may not behave as expected.")
        }

        choices.push({name: "Let me type a machine type", value: "_"})

        const selectedMachineType = await select({
            message: 'Choose a machine type:',
            choices: choices,
            loop: false,
        })

        if(selectedMachineType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        return selectedMachineType        
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

    private async region(client: GcpClient, region?: string): Promise<string> {
        if (region) {
            return region
        }

        const regions = await client.listRegions()

        const selected = await select({
            message: 'Select region to use:',
            choices: regions
                .filter(r => r.name && r.id)
                .map(r => ({ name: `${r.name!} (${r.description})`, value: r.name!}))
        })

        return selected.toString()
    }

    private async zone(client: GcpClient, region: string, zone?: string): Promise<string> {
        if (zone) {
            return zone
        }
        
        const zones =  await client.listRegionZones(region)

        if(zones.length == 0){
            throw new Error(`No zones found in region ${region}`)
        }

        return await select({
            message: 'Select zone to use:',
            choices: zones.map(z => ({name: z, value: z})),
            default: zones[0]
        })
    }

    private async project(projectId?: string): Promise<string> {
        if (projectId) {
            return projectId
        }

        const projects = await GcpClient.listProjects()

        return await select({
            message: 'Select a project to use:',
            choices: projects
                .filter(p => p.projectId)
                .map(p => ({name: `${p.displayName} (${p.projectId})`, value: p.projectId!}))
        })
    }

    private async acceleratorType(client: GcpClient, zone: string, acceleratorType?: string): Promise<string> {
        if (acceleratorType) {
            return acceleratorType
        }

        const acceleratorTypes = await client.listAcceleratorTypes(zone)

        const choices = acceleratorTypes.filter(t => t.name)
            .filter(t => 
                t.name && t.name.startsWith("nvidia") && !t.name.includes("vws") && // only support NVIDIA for now and remove workstations
                t.name != "nvidia-h100-80gb" && t.name != "nvidia-h100-mega-80gb" // not supported yet
            ) 
            .map(t => ({name: `${t.description} (${t.name})`, value: t.name!}))
            .sort()

        return await select({
            message: 'Select GPU type (accelerator type) to use:',
            choices: choices,
            loop: false
        })
    }
}

export class GcpCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand() {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_GCP)
            .addOption(CLI_OPTION_SPOT)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .addOption(CLI_OPTION_COST_ALERT)
            .addOption(CLI_OPTION_COST_LIMIT)
            .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
            .addOption(CLI_OPTION_STREAMING_SERVER)
            .option('--machine-type <machinetype>', 'Machine type to use for the instance')
            .option('--region <region>', 'Region in which to deploy instance')
            .option('--zone <zone>', 'Zone within the region to deploy the instance')
            .option('--project-id <projectid>', 'GCP Project ID in which to deploy resources')
            .option('--gpu-type <gputype>', 'Type of accelerator (e.g., GPU) to attach to the instance')
            .action(async (cliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_GCP })
                try {
                    await new InteractiveInstanceInitializer<GcpCreateCliArgs>({ 
                        inputPrompter: new GcpInputPrompter(),
                        provider: CLOUDYPAD_PROVIDER_GCP,
                    }).initializeInstance(cliArgs)
                    
                } catch (error) {
                    throw new Error('GCP instance initilization failed', { cause: error })
                }
            })
    }

    buildUpdateCommand() {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_GCP)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .addOption(CLI_OPTION_COST_ALERT)
            .addOption(CLI_OPTION_COST_LIMIT)
            .addOption(CLI_OPTION_COST_NOTIFICATION_EMAIL)
            .option('--machine-type <machinetype>', 'Machine type to use for the instance')
            .option('--gpu-type <gputype>', 'Type of accelerator (e.g., GPU) to attach to the instance')
            .action(async (cliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_GCP })
                try {
                    await new InstanceUpdater<GcpInstanceStateV1, GcpUpdateCliArgs>({
                        stateParser: new GcpStateParser(),
                        inputPrompter: new GcpInputPrompter()
                    }).update(cliArgs)

                    console.info(`Updated instance ${cliArgs.name}`)

                } catch (error) {
                    throw new Error('GCP instance update failed', { cause: error })
                }
            })
    }
}