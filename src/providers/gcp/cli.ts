import { MACHINE_GPU_COMPAT, DISK_TYPE_DESCRIPTIONS, NETWORK_TIER_DESCRIPTIONS, NIC_TYPE_DESCRIPTIONS, DEFAULT_DISK_TYPE, DEFAULT_NETWORK_TIER, DEFAULT_NIC_TYPE, MACHINE_TYPE_FAMILY_DESCRIPTIONS, MACHINE_TYPE_FAMILIES_GAMING, NETWORK_TIERS, NIC_TYPES, DISK_TYPES } from "./const";
import { GPU_DESCRIPTIONS, REGION_PREFIX_LABELS, REGION_COUNTRY_BY_REGION } from "./const";
import { GcpInstanceInput, GcpInstanceStateV1, GcpProvisionInputV1, GcpProvisionInputV1Schema } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { input, select } from '@inquirer/prompts';
import { AbstractInputPrompter, costAlertCliArgsIntoConfig, PromptOptions, AbstractInputPrompterArgs } from "../../cli/prompter";
import { GcpClient } from "./sdk-client";
import lodash from 'lodash'
import { CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE } from "../../core/const";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_COST_ALERT, CLI_OPTION_COST_LIMIT, CLI_OPTION_COST_NOTIFICATION_EMAIL, CLI_OPTION_DISK_SIZE, CLI_OPTION_DATA_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_KEYBOARD_OPTIONS, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_VARIANT, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_RATE_LIMIT_MAX_MBPS, CLI_OPTION_SUNSHINE_MAX_BITRATE_KBPS, CLI_OPTION_DATA_DISK_SNAPSHOT_ENABLE, CLI_OPTION_BASE_IMAGE_SNAPSHOT_ENABLE, CLI_OPTION_KEEP_BASE_IMAGE_ON_DELETION, CLI_OPTION_DELETE_INSTANCE_SERVER_ON_STOP } from "../../cli/command";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { GcpProviderClient } from "./provider";

export interface GcpCreateCliArgs extends CreateCliArgs {
  projectId?: string
  region?: string
  zone?: string
  machineType?: string
  diskSize?: number
  dataDiskSize?: number
  diskType?: string
  networkTier?: string
  nicType?: string
  publicIpType?: PUBLIC_IP_TYPE
  gpuType?: string
  spot?: boolean,
  costAlert?: boolean
  costLimit?: number
  costNotificationEmail?: string
  dataDiskSnapshotEnable?: boolean
  baseImageSnapshotEnable?: boolean
  keepBaseImageOnDeletion?: boolean
  deleteInstanceServerOnStop?: boolean
}

/** Possible update arguments for GCP update. */
export type GcpUpdateCliArgs = UpdateCliArgs & Omit<GcpCreateCliArgs, "projectId" | "region" | "zone">

// Narrow API surface needed by the prompter for dependency injection and testing
export type GcpApi = Pick<GcpClient,
  | "listRegions"
  | "listRegionZones"
  | "listMachineTypes"
  | "listAcceleratorTypes"
  | "listDiskTypes"
>;

export interface GcpInputPrompterArgs extends AbstractInputPrompterArgs {
  /** Optional factory to create a GCP API client; useful for tests. */
  clientFactory?: (name: string, projectId: string) => GcpApi;
  /** Optional inquirer select function injection; useful for tests. */
  selectFn?: typeof select;
}

export class GcpInputPrompter extends AbstractInputPrompter<GcpCreateCliArgs, GcpProvisionInputV1, CommonConfigurationInputV1> {

  private readonly clientFactory?: (name: string, projectId: string) => GcpApi;
  private readonly selectFn?: typeof select;

  constructor(args: GcpInputPrompterArgs) {
    super(args);
    this.clientFactory = args.clientFactory;
    this.selectFn = args.selectFn;
  }

  /**
   * Centralized accessor to the select prompt; primarily here to keep call sites DRY.
   * Tests should inject a custom function via args.selectFn rather than subclassing.
   */
  private getSelect() { return this.selectFn ?? select }

  /** Build the initial partial input from CLI args (strings are narrowed to enum literal unions). */
  protected buildProvisionerInputFromCliArgs(cliArgs: GcpCreateCliArgs): PartialDeep<GcpInstanceInput> {
    return {
      provision: {
        machineType: cliArgs.machineType,
        diskSize: cliArgs.diskSize,
        dataDiskSizeGb: cliArgs.dataDiskSize,
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
        deleteInstanceServerOnStop: cliArgs.deleteInstanceServerOnStop,
        dataDiskSnapshot: cliArgs.dataDiskSnapshotEnable ? { 
          enable: cliArgs.dataDiskSnapshotEnable 
        } : undefined,
        baseImageSnapshot: cliArgs.baseImageSnapshotEnable ? { 
          enable: cliArgs.baseImageSnapshotEnable,
          keepOnDeletion: cliArgs.keepBaseImageOnDeletion
        } : undefined,
      },
    }
  }

  /** Ask all provider-specific params and return a fully typed GcpInstanceInput. */
  protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<GcpInstanceInput>, createOptions: PromptOptions): Promise<GcpInstanceInput> {
    if (!createOptions.autoApprove && !createOptions.skipQuotaWarning) {
      await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_GCP, "https://docs.cloudypad.gg/cloud-provider-setup/gcp.html")
    }

    const projectId = await this.project(partialInput.provision?.projectId)
    const client: GcpApi = this.clientFactory
      ? this.clientFactory(GcpInputPrompter.name, projectId)
      : new GcpClient(GcpInputPrompter.name, projectId)
    const region = await this.region(client, partialInput.provision?.region)
    const zone = await this.zone(client, region, partialInput.provision?.zone)
    const machineType = await this.machineType(client, zone, partialInput.provision?.machineType)
    const acceleratorType = await this.acceleratorType(client, zone, partialInput.provision?.acceleratorType, machineType)
    const useSpot = await this.useSpotInstance(partialInput.provision?.useSpot)
    const diskSize = await this.diskSize(partialInput.provision?.diskSize)
    const diskType = await this.diskType({ diskType: partialInput.provision?.diskType, client: client, zone: zone })
    const networkTier = await this.networkTier(partialInput.provision?.networkTier)
    const nicType = await this.nicType(partialInput.provision?.nicType)
    const publicIpType = await this.publicIpType(partialInput.provision?.publicIpType)
    const costAlert = await this.costAlert(partialInput.provision?.costAlert)

    // Merge into final input (lodash.merge is fine here since we already narrowed the literals).
    const gcpInput: GcpInstanceInput = lodash.merge(
      {},
      commonInput,
      {
        provision: {
          projectId,
          diskSize,
          diskType,
          networkTier,
          nicType,
          machineType,
          publicIpType,
          region,
          zone,
          acceleratorType,
          useSpot,
          costAlert,
          deleteInstanceServerOnStop: partialInput.provision?.deleteInstanceServerOnStop,
          dataDiskSnapshot: partialInput.provision?.dataDiskSnapshot?.enable ? { 
            enable: partialInput.provision.dataDiskSnapshot.enable 
          } : undefined,
          baseImageSnapshot: partialInput.provision?.baseImageSnapshot?.enable ? { 
              enable: partialInput.provision.baseImageSnapshot.enable,
              keepOnDeletion: partialInput.provision.baseImageSnapshot.keepOnDeletion
          } : undefined,
          dataDiskSizeGb: partialInput.provision?.dataDiskSizeGb ?? 0, // Use CLI arg if provided, otherwise default to 0
        },
      }
    )
    return gcpInput
  }

  /** Prompt for disk type using intersection of schema enum and available API values. */
  private async diskType(args: { diskType?: string, client: GcpApi, zone: string }): Promise<string> {
    if (args.diskType) return args.diskType;
       
    let availableDiskTypes: string[] = [];
    try {
      availableDiskTypes = await args.client.listDiskTypes(args.zone);
    } catch (e) {
      console.warn(`Failed to fetch disk types from GCP API for zone ${args.zone}. Showing all supported disk types by default. Error:`, e);
      availableDiskTypes = DISK_TYPES;
    }

    const allowed = new Set<string>(DISK_TYPES);
    const filtered = availableDiskTypes.filter((v: string) => allowed.has(v));

    const choices = filtered.map((v: string) => {
      const desc = DISK_TYPE_DESCRIPTIONS[v] || v;
      return { name: `${desc} [${v}]`, value: v };
    });
    if (choices.length === 0) {
      throw new Error(`No supported disk types available in zone ${args.zone}.`);
    }

    return await this.getSelect()({
      message: 'Select disk type (affects performance & price):',
      choices,
      default: filtered.includes(DEFAULT_DISK_TYPE) ? DEFAULT_DISK_TYPE : choices[0].value,
    });
  }

  /** Prompt for network tier with simple explanations. */
  private async networkTier(networkTier?: string): Promise<string> {
    if (networkTier) return networkTier;

    const choices = NETWORK_TIERS.map((v: string) => {
      const desc = NETWORK_TIER_DESCRIPTIONS[v] || v;
      return { name: `${desc} [${v}]`, value: v };
    });

    return await this.getSelect()({
      message: 'Select network tier (applies to outgoing internet traffic - affects latency & price):',
      choices,
      default: DEFAULT_NETWORK_TIER,
    });
  }

  /** Prompt for NIC type with simple explanations. */
  private async nicType(nicType?: string): Promise<string> {
    if (nicType) return nicType;

    const choices = NIC_TYPES.map((v: string) => {
      const desc = NIC_TYPE_DESCRIPTIONS[v] || v;
      return { name: `${desc} [${v}]`, value: v };
    });
    return await this.getSelect()({
      message: 'Select NIC type (affects network performance):',
      choices,
      default: DEFAULT_NIC_TYPE,
    });
  }

  private async machineType(client: GcpApi, zone: string, machineType?: string): Promise<string> {
    if (machineType) return machineType;

    const machineTypes = await client.listMachineTypes(zone);
    const acceleratorTypes = await client.listAcceleratorTypes(zone);

    // Build a set of available GPU names in this zone
    const availableGpuNames = new Set(acceleratorTypes.map(a => a.name).filter(Boolean));

    // Filter machine types: must be gaming, and at least one compatible GPU is available in this zone
    const gamingMachineTypes = machineTypes
      .filter(t => t.name && isGamingMachineType(t))
      .filter(t => {
        const family = t.name!.split('-')[0];
        const compatGpus = MACHINE_GPU_COMPAT[family] || [];
        return compatGpus.some(gpu => availableGpuNames.has(gpu));
      })
      .sort((a, b) => {
        if (a.guestCpus === b.guestCpus) {
          return a.memoryMb! - b.memoryMb!;
        }
        return a.guestCpus! - b.guestCpus!;
      })
      .map(t => {
        const family = t.name!.split('-')[0];
        const familyDesc = MACHINE_TYPE_FAMILY_DESCRIPTIONS[family] ? ` | ${MACHINE_TYPE_FAMILY_DESCRIPTIONS[family]}` : '';
        return {
          name: `${t.name} (CPUs: ${t.guestCpus}, RAM: ${Math.round(t.memoryMb! / 100) / 10} GiB)${familyDesc}`,
          value: t.name!,
        };
      });

    if (gamingMachineTypes.length === 0) {
      const fams = MACHINE_TYPE_FAMILIES_GAMING.join(', ');
      this.logger.warn(`No suitable machine type with available GPU in selected zone for families: ${fams}. You can still choose your own instance type but setup may not behave as expected.`)
    }

    gamingMachineTypes.push({ name: "Let me type a machine type", value: "_" })

    const selectedMachineType = await this.getSelect()({
      message: 'Choose a machine type:',
      choices: gamingMachineTypes,
      loop: false,
    })

    if (selectedMachineType === '_') {
      return await input({ message: 'Enter machine type:' })
    }

    return selectedMachineType
  }

  private async diskSize(diskSize?: number): Promise<number> {
    if (diskSize) return diskSize;

    const selectedDiskSize = await input({
      message: 'Enter desired disk size (GB):',
      default: "100"
    })
    return Number.parseInt(selectedDiskSize)
  }

  private async region(client: GcpApi, region?: string): Promise<string> {
    if (region) return region;

    // Build continent choices dynamically from available region names.
    // We derive a prefix by taking the first segment followed by a dash (e.g., "europe-west4" -> "europe-").
    const allRegions = await client.listRegions();
    // Normalize region names (trim/lowercase) and build a unique, sorted set of prefixes like "europe-", "us-".
    const prefixSet = new Set<string>();
    for (const r of allRegions) {
      const name = (r?.name ?? '').trim().toLowerCase();
      if (!name) continue;
      const dashIdx = name.indexOf('-');
      if (dashIdx <= 0) continue; // unexpected, but skip if no dash
      const prefix = name.slice(0, dashIdx + 1); // include trailing '-'
      prefixSet.add(prefix);
    }
    const sortedPrefixes = Array.from(prefixSet).sort();

    // Group prefixes by display label to avoid duplicate continent entries
    const labelToPrefixes = new Map<string, string[]>();
    for (const prefix of sortedPrefixes) {
      const base = prefix.replace(/-$/, '');
      const fallback = base ? base.charAt(0).toUpperCase() + base.slice(1) : '<UNKNOWN>';
      const map = REGION_PREFIX_LABELS;
      const label = Object.prototype.hasOwnProperty.call(map, prefix)
        ? map[prefix]
        : fallback;
      const list = labelToPrefixes.get(label) ?? [];
      list.push(prefix);
      labelToPrefixes.set(label, list);
    }
    const continentChoices = Array.from(labelToPrefixes.keys())
      .sort()
      .map(label => ({ name: label, value: label }));

    const userContinentLabel = await this.getSelect()({
      message: 'Select your continent for the closest regions:',
      choices: continentChoices.length > 0 ? continentChoices : [ { name: '<UNKNOWN>', value: '' } ],
      default: continentChoices.find(c => c.value === 'Europe') ? 'Europe' : (continentChoices[0]?.value ?? ''),
    });

    // Inform user that region discovery may take a little time as several API calls are performed
    console.info('\nListing available GCP regions with compatible gaming machine types and GPUs... (this can take ~10-30s)')

    // Only keep regions matching any prefix of the selected continent label (reuse already fetched list)
    const selectedPrefixes = labelToPrefixes.get(userContinentLabel) ?? [];
    const regions = allRegions.filter(r => selectedPrefixes.some(p => (r.name ?? '').startsWith(p)));

    // For each region, fetch zones in parallel
    type RegionZone = { region: typeof regions[number], zones: string[] };
    const regionZoneMap = (await Promise.all(
      regions.map(async r => {
        if (!r.name) return null;
        try {
          const zones = await client.listRegionZones(r.name);
          return { region: r, zones };
        } catch {
          return null;
        }
      })
    ))

    // For each region, test all zones in parallel and stop at the first valid (gaming+GPU) zone using Promise.any
    const regionChecks = await Promise.all(
      regionZoneMap
        .filter((item): item is RegionZone => !!item)
        .map(async ({ region: r, zones }) => {
          try {
            await Promise.any(
              zones.map(async (zone) => {
                const [machineTypes, acceleratorTypes] = await Promise.all([
                  client.listMachineTypes(zone),
                  client.listAcceleratorTypes(zone)
                ]);
                const availableGpuNames = new Set(acceleratorTypes.map(a => a.name).filter(Boolean));
                const hasGamingWithGpu = machineTypes.some(t => {
                  if (!t.name || !isGamingMachineType(t)) return false;
                  const family = t.name.split('-')[0];
                  const compatGpus = MACHINE_GPU_COMPAT[family] || [];
                  return compatGpus.some(gpu => availableGpuNames.has(gpu));
                });
                if (hasGamingWithGpu) {
                  // Found a valid zone, resolve Promise.any
                  return true;
                }
                // Otherwise, throw to continue Promise.any
                throw new Error('No valid machine+GPU in this zone');
              })
            );
            // If we get here, at least one zone is valid
            const country = REGION_COUNTRY_BY_REGION[(r.name ?? '')];
            const label = country ? `${r.name} (${country})` : `${r.name}`;
            return { name: label, value: r.name };
          } catch {
            // No zone in this region has a gaming machine with compatible GPU
            return null;
          }
        })
    );

    const regionChoices = regionChecks.filter((item): item is { name: string, value: string } => !!item);

    if (regionChoices.length === 0) {
      const fams = MACHINE_TYPE_FAMILIES_GAMING.join(', ');
      throw new Error(`No region found with available machine types: ${fams}.`);
    }
    const selected = await this.getSelect()({
      message: `Select region to use (only regions with gaming machine types are shown: ${MACHINE_TYPE_FAMILIES_GAMING.join(', ')})`,
      choices: regionChoices
    });
    return selected.toString();
  }

  private async zone(client: GcpApi, region: string, zone?: string): Promise<string> {
    if (zone) return zone;

    // Inform user about zone filtering duration
    console.info(`\nListing zones in region ${region} with compatible gaming machine types and GPUs... (this can take ~5-20s)`)    

    const zones = await client.listRegionZones(region);
    if (zones.length === 0) throw new Error(`No zones found in region ${region}`);

    // Test all zones in parallel, add each valid (gaming+GPU) zone to the list
    const zoneChecks = await Promise.all(zones.map(async z => {
      try {
        const [machineTypes, acceleratorTypes] = await Promise.all([
          client.listMachineTypes(z),
          client.listAcceleratorTypes(z)
        ]);
        const availableGpuNames = new Set(acceleratorTypes.map(a => a.name).filter(Boolean));
        const hasGamingWithGpu = machineTypes.some(t => {
          if (!t.name || !isGamingMachineType(t)) return false;
          const family = t.name.split('-')[0];
          const compatGpus = MACHINE_GPU_COMPAT[family] || [];
          return compatGpus.some(gpu => availableGpuNames.has(gpu));
        });
        if (hasGamingWithGpu) {
          return z;
        }
      } catch (e) {
        this.logger.warn(`[zone filter] Failed to list machine types or accelerators for zone ${z}: ${e}`);
      }
      return null;
    }));
    const gamingZones = zoneChecks.filter((z): z is string => !!z);

    if (gamingZones.length === 0) {
      const fams = MACHINE_TYPE_FAMILIES_GAMING.join(', ');
      throw new Error(`No zone found in region ${region} with available machine types: ${fams}.`);
    }

    return await this.getSelect()({
      message: `Select zone to use (zones with gaming machine types: ${MACHINE_TYPE_FAMILIES_GAMING.join(', ')})`,
      choices: gamingZones.map(z => ({ name: z, value: z })),
      default: gamingZones[0]
    });
  }

  private async project(projectId?: string): Promise<string> {
    if (projectId) return projectId;

    const projects = await GcpClient.listProjects()
    return await this.getSelect()({
      message: 'Select a project to use:',
      choices: projects
        .filter(p => p.projectId)
        .map(p => ({ name: `${p.displayName} (${p.projectId})`, value: p.projectId! }))
    })
  }

  private async acceleratorType(client: GcpApi, zone: string, acceleratorType?: string, machineType?: string): Promise<string> {
    if (acceleratorType) return acceleratorType;

    const acceleratorTypes = await client.listAcceleratorTypes(zone)

    // Deduce family from machineType (e.g. 'n1-standard-4' → 'n1')
    const family = machineType?.split('-')[0] ?? '';
    const allowedGpus = MACHINE_GPU_COMPAT[family] || [];

    const choices = acceleratorTypes.filter(t => t.name && allowedGpus.includes(t.name))
      .map(t => {
        const gpuInfo = GPU_DESCRIPTIONS[t.name!];
        const desc = gpuInfo ? `${gpuInfo.label} [Type: ${gpuInfo.type}]` : (t.description || t.name!);
        return { name: `${desc} (${t.name})`, value: t.name! };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (choices.length === 0) {
      choices.push({ name: 'No compatible GPU available for this machine type', value: '' });
    }

    return await this.getSelect()({
      message: 'Select GPU type (accelerator type) to use:',
      choices,
      loop: false
    })
  }
}

/** Returns true if the machine type matches gaming criteria (family, CPU, RAM). */
export function isGamingMachineType(t: { name?: string | null, guestCpus?: number | null, memoryMb?: number | null }): boolean {
  const isGamingType = t.name && MACHINE_TYPE_FAMILIES_GAMING.some(fam => t.name!.startsWith(fam));
  const enoughCpu = t.guestCpus != null && t.guestCpus >= 2 && t.guestCpus <= 16;
  const enoughRam = t.memoryMb != null && t.memoryMb >= 1000 && t.memoryMb <= 100000;
  return Boolean(isGamingType && enoughCpu && enoughRam);
}

export class GcpCliCommandGenerator extends CliCommandGenerator {

  buildCreateCommand(args: BuildCreateCommandArgs) {
    return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_GCP)
      .addOption(CLI_OPTION_SPOT)
      .addOption(CLI_OPTION_DISK_SIZE)
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
