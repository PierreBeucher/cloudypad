import { GcpInstanceInput, GcpInstanceStateV1, GcpProvisionInputV1, GcpProvisionInputV1Schema } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { input, select } from '@inquirer/prompts';
import { AbstractInputPrompter, costAlertCliArgsIntoConfig, PromptOptions } from "../../cli/prompter";
import { GcpClient } from "./sdk-client";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE } from "../../core/const";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_KEYBOARD_OPTIONS, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_VARIANT, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_RATE_LIMIT_MAX_MBPS, CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS } from "../../cli/command";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { GcpProviderClient } from "./provider";

export interface GcpCreateCliArgs extends CreateCliArgs {
    projectId?: string
    region?: string
    zone?: string
    machineType?: string
    diskSize?: number
    diskType?: string
    networkTier?: string
    nicType?: string
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

export class GcpInputPrompter extends AbstractInputPrompter<GcpCreateCliArgs, GcpProvisionInputV1, CommonConfigurationInputV1> {
    
    protected buildProvisionerInputFromCliArgs(cliArgs: GcpCreateCliArgs): PartialDeep<GcpInstanceInput> {
        return {
            provision:{ 
                machineType: cliArgs.machineType,
                diskSize: cliArgs.diskSize,
                diskType: cliArgs.diskType,
                networkTier: cliArgs.networkTier,
                nicType: cliArgs.nicType,
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

    /**
     * Prompts the user for all GCP-specific instance parameters, including disk type, network tier, and NIC type.
     * Each prompt includes a short explanation in parentheses to help the user choose.
     */
    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<GcpInstanceInput>, createOptions: PromptOptions): Promise<GcpInstanceInput> {
        // Warn about quota if needed
        if(!createOptions.autoApprove && !createOptions.skipQuotaWarning){
            await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_GCP, "https://docs.cloudypad.gg/cloud-provider-setup/gcp.html")
        }
        // Prompt for GCP project
        const projectId = await this.project(partialInput.provision?.projectId)
        // Prompt for region (latency and cost may vary)
        const client = new GcpClient(GcpInputPrompter.name, projectId)
        const region = await this.region(client, partialInput.provision?.region)
        // Prompt for zone (affects latency, availability)
        const zone = await this.zone(client, region, partialInput.provision?.zone)
        // Prompt for machine type (CPU/RAM)
        const machineType = await this.machineType(client, zone, partialInput.provision?.machineType)
        // Prompt for accelerator (GPU)
        const acceleratorType = await this.acceleratorType(client, zone, partialInput.provision?.acceleratorType)
        // Prompt for spot/preemptible instance
        const useSpot = await this.useSpotInstance(partialInput.provision?.useSpot)
        // Prompt for disk size (GB)
        const diskSize = await this.diskSize(partialInput.provision?.diskSize)
        // Prompt for disk type (performance & price)
        const diskType = await this.diskType(partialInput.provision?.diskType, client, zone)
        // Prompt for network tier (latency & price)
        const networkTier = await this.networkTier(partialInput.provision?.networkTier)
        // Prompt for NIC type (network performance)
        const nicType = await this.nicType(partialInput.provision?.nicType)
        // Prompt for public IP type
        const publicIpType = await this.publicIpType(partialInput.provision?.publicIpType)
        // Prompt for cost alert
        const costAlert = await this.costAlert(partialInput.provision?.costAlert)
        // Merge all answers into the final input object
        const gcpInput: GcpInstanceInput = lodash.merge(
            {},
            commonInput,
            {
                provision: {
                    projectId: projectId,
                    diskSize: diskSize,
                    diskType: diskType,
                    networkTier: networkTier,
                    nicType: nicType,
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

    /**
     * Prompt for disk type using intersection of allowed enum and available disk types from GCP API.
     * Requires client and zone to fetch available disk types.
     */
    private async diskType(diskType?: string, client?: GcpClient, zone?: string): Promise<string> {
        if (!client || !zone) {
            throw new Error("diskType prompt requires GcpClient and zone arguments for dynamic fetching.");
        }
        const diskTypeEnum = GcpProvisionInputV1Schema.shape.diskType.options;
        const DiskTypeDescriptions: Record<string, string> = {
            'pd-standard': 'Standard (cheapest, slowest)',
            'pd-balanced': 'Balanced (good compromise)',
            'pd-ssd': 'SSD (best performance, highest cost)',
        };
        let availableDiskTypes: string[] = [];
        try {
            availableDiskTypes = await client.listDiskTypes(zone);
        } catch {
            // fallback: show all enum values if API fails
            console.warn(`Failed to fetch disk types from GCP API for zone ${zone}:`, error);
            availableDiskTypes = diskTypeEnum;
        }
        // Filter API values by enum: keep only API values that are in the enum
        const filtered = availableDiskTypes.filter(v => diskTypeEnum.includes(v));
        const choices = filtered.map((v) => {
            // Use description if available, else fallback to value
            const desc = DiskTypeDescriptions[v] || v;
            return { name: `${desc} [${v}]`, value: v };
        });
        if (choices.length === 0) {
            throw new Error(`No supported disk types available in zone ${zone}.`);
        }
        return await select({
            message: 'Select disk type (affects performance & price):',
            choices,
            default: filtered.includes('pd-balanced') ? 'pd-balanced' : choices[0].value,
        });
    }

    /**
     * Prompt for network tier using enum values and explanations.
     */
    private async networkTier(networkTier?: string): Promise<string> {
        if (networkTier) return networkTier;
        const networkTierEnum = GcpProvisionInputV1Schema.shape.networkTier.options;
        const NetworkTierDescriptions: Record<string, string> = {
            'STANDARD': 'Standard (higher latency, cheaper)',
            'PREMIUM': 'Premium (lower latency, more expensive)',
        };
        const choices = networkTierEnum.map((v) => {
            const desc = NetworkTierDescriptions[v] || v;
            return { name: `${desc} [${v}]`, value: v };
        });
        return await select({
            message: 'Select network tier (affects latency & price):',
            choices,
            default: 'STANDARD',
        });
    }

    /**
     * Prompt for NIC type using enum values and explanations.
     */
    private async nicType(nicType?: string): Promise<string> {
        if (nicType) return nicType;
        const nicTypeEnum = GcpProvisionInputV1Schema.shape.nicType.options;
        const NicTypeDescriptions: Record<string, string> = {
            'auto': 'Auto (let GCP choose, recommended)',
            'GVNIC': 'GVNIC (best performance, lowest latency, only on some VMs)',
            'VIRTIO_NET': 'Virtio Net (legacy, compatible)',
        };
        const choices = nicTypeEnum.map((v) => {
            const desc = NicTypeDescriptions[v] || v;
            return { name: `${desc} [${v}]`, value: v };
        });
        return await select({
            message: 'Select NIC type (affects network performance):',
            choices,
            default: 'auto',
        });
    }

    private async machineType(client: GcpClient, zone: string, machineType?: string): Promise<string> {
        if (machineType) {
            return machineType
        }

        const machineTypes = await client.listMachineTypes(zone)

    // Include n1 and g2, and filter for specs suitable for gaming
        const gamingMachineTypes = machineTypes
            .filter(t => t.name)
            .filter(t => {
                const isGamingType = t.name && (t.name.startsWith("n1") || t.name.startsWith("g2"));
                // Gaming criteria: at least 4 CPUs, 15+ GiB RAM, max 128 CPUs, max 512 GiB RAM
                const enoughCpu = t.guestCpus && t.guestCpus >= 4 && t.guestCpus <= 128;
                const enoughRam = t.memoryMb && t.memoryMb >= 15000 && t.memoryMb <= 524288;
                return isGamingType && enoughCpu && enoughRam;
            })
            .sort((a, b) => {
                if (a.guestCpus === b.guestCpus) {
                    return a.memoryMb! - b.memoryMb!;
                }
                return a.guestCpus! - b.guestCpus!;
            })
            .map(t => ({
                name: `${t.name} (CPUs: ${t.guestCpus}, RAM: ${Math.round(t.memoryMb! / 100)/10} GiB)`,
                value: t.name!,
            }));

        if(gamingMachineTypes.length === 0){
            this.logger.warn("No suitable N1 or G2 machine type available in selected zone. You can still choose your own instance type but setup may not behave as expected.")
        }

        gamingMachineTypes.push({name: "Let me type a machine type", value: "_"})

        const selectedMachineType = await select({
            message: 'Choose a machine type:',
            choices: gamingMachineTypes,
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

        // Explanatory mapping for common gaming GPUs
        const GpuDescriptions: Record<string, { label: string, type: string }> = {
            'nvidia-tesla-t4': { label: 'NVIDIA T4 (great for cloud gaming, 16GB VRAM)', type: 'T4' },
            'nvidia-l4': { label: 'NVIDIA L4 (new generation, 24GB VRAM, very performant for streaming)', type: 'L4' },
            'nvidia-a10g': { label: 'NVIDIA A10G (high-end, 24GB VRAM, advanced AI and gaming)', type: 'A10G' },
            'nvidia-p4': { label: 'NVIDIA P4 (entry-level, 8GB VRAM, sufficient for light games)', type: 'P4' },
            'nvidia-p100': { label: 'NVIDIA P100 (16GB VRAM, compute and advanced gaming)', type: 'P100' },
            'nvidia-v100': { label: 'NVIDIA V100 (16/32GB VRAM, very performant, overkill for gaming)', type: 'V100' },
            // Add more GPUs if needed
        };

        const choices = acceleratorTypes.filter(t => t.name)
            .filter(t => 
                t.name && t.name.startsWith("nvidia") && !t.name.includes("vws") &&
                t.name != "nvidia-h100-80gb" && t.name != "nvidia-h100-mega-80gb"
            )
            .map(t => {
                const gpuInfo = GpuDescriptions[t.name!];
                const desc = gpuInfo ? `${gpuInfo.label} [Type: ${gpuInfo.type}]` : (t.description || t.name!);
                return { name: `${desc} (${t.name})`, value: t.name! };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        return await select({
            message: 'Select GPU type (accelerator type) to use:',
            choices: choices,
            loop: false
        })
    }
}

export class GcpCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_GCP)
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
            .addOption(CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS)
            .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
            .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
            .addOption(CLI_OPTION_USE_LOCALE)
            .addOption(CLI_OPTION_KEYBOARD_LAYOUT)
            .addOption(CLI_OPTION_KEYBOARD_MODEL)
            .addOption(CLI_OPTION_KEYBOARD_VARIANT)
            .addOption(CLI_OPTION_KEYBOARD_OPTIONS)
            .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
            .option('--machine-type <machinetype>', 'Machine type to use for the instance')
            .option('--region <region>', 'Region in which to deploy instance')
            .option('--zone <zone>', 'Zone within the region to deploy the instance')
            .option('--project-id <projectid>', 'GCP Project ID in which to deploy resources')
            .option('--gpu-type <gputype>', 'Type of accelerator (e.g., GPU) to attach to the instance')
            .option('--disk-type <disktype>', 'Disk type to use (pd-standard, pd-balanced, pd-ssd)')
            .option('--network-tier <networktier>', 'Network tier to use (STANDARD, PREMIUM)')
            .option('--nic-type <nictype>', 'NIC type to use (auto, GVNIC, VIRTIO_NET)')
            .action(async (cliArgs: GcpCreateCliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_GCP })
                try {
                    await new InteractiveInstanceInitializer<GcpInstanceStateV1, GcpCreateCliArgs>({ 
                        providerClient: new GcpProviderClient({ config: args.coreConfig }),
                        inputPrompter: new GcpInputPrompter({ coreConfig: args.coreConfig }),
                        initArgs: cliArgs
                    }).initializeInteractive()
                    
                } catch (error) {
                    throw new Error('GCP instance initilization failed', { cause: error })
                }
            })
    }

    buildUpdateCommand(args: BuildUpdateCommandArgs) {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_GCP)
            .addOption(CLI_OPTION_DISK_SIZE)
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
            .option('--machine-type <machinetype>', 'Machine type to use for the instance')
            .option('--gpu-type <gputype>', 'Type of accelerator (e.g., GPU) to attach to the instance')
            .action(async (cliArgs: GcpUpdateCliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_GCP })
                try {
                    await new InteractiveInstanceUpdater<GcpInstanceStateV1, GcpUpdateCliArgs>({
                        providerClient: new GcpProviderClient({ config: args.coreConfig }),
                        inputPrompter: new GcpInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)

                    console.info(`Updated instance ${cliArgs.name}`)

                } catch (error) {
                    throw new Error('GCP instance update failed', { cause: error })
                }
            })
    }
}